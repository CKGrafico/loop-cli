# Loop Playbooks

## Label-Based State Machines

Loop Task has no persistent per-item state. Each iteration starts with a fresh context, and context is discarded after completion. To track where a work item is in its lifecycle, use **external state markers** — labels, tags, statuses, or flags on the items themselves.

A **label state machine** treats external labels as the work-item's state. The selection Task queries for items with a specific label. The reservation Task transitions the label. The chain processes the item. Finalization transitions the label to its terminal state. Recovery reverts the label to its selection state.

### Label lifecycle

```
pick → doing → pr → done
            ↓ (failure)
          pick (reverted)
```

Each label represents a stage. The selection Task selects items at `pick`. The reservation Task moves the item to `doing`. Finalization moves it to `pr` then `done`. Recovery moves it back to `pick`.

### Rules

- The selection Task queries the **entry label** (e.g., `pick`).
- The reservation Task removes the entry label and adds the **reservation label** (e.g., `doing`) — this prevents duplicate selection by other Loops or manual triggers.
- Finalization transitions the label to the **next stage** (e.g., `pr`).
- Recovery reverts the label back to the entry label, making the item eligible again.
- A gate Task (onSuccess) that finds no work exits non-zero with no `onFailure` — the chain terminates and the Loop waits for the next cadence.

### Why labels work

Labels exist on the work items, external to Loop Task. A crashed iteration leaves the item in `doing` — the next iteration will skip it. Recovery explicitly reverts the label, returning the item to the pool. Multiple Loops can coordinate through shared labels: one Loop's finalization label is another Loop's selection label.

## Multi-Loop Pipelines

Multiple Loops can form a **pipeline**: each Loop produces work for the next. They coordinate through shared labels, each Loop's output label being another Loop's input label.

```
Loop A (producer):  finds work, processes, labels output as "ready for B"
Loop B (consumer):  selects items labeled "ready for B", processes, labels output as "done"
```

### Staging

Each Loop is independent — it has its own cadence, its own chain, its own failure handling. But they share a label vocabulary. The producer Loop's finalization Task adds a label the consumer Loop's selection Task queries for.

| Loop role | Selection label | Finalization label | Cadence |
|---|---|---|---|
| Producer | (creates items) | `stage:next` | Slow (creates work) |
| Consumer | `stage:next` | `done` | Fast (processes work) |

### Pipeline design principles

- **Decouple cadences**: each Loop runs at its own pace. The producer may be slow (creating items), the consumer fast (processing them). They meet at the label boundary.
- **No direct coupling**: Loops share state only through labels. A consumer does not know which producer created the item. A producer does not know which consumer will process it.
- **Backpressure is implicit**: if the consumer is slow, items accumulate at the stage label. If the producer is slow, the consumer finds no work and terminates cleanly each iteration.
- **Context is separate**: each Loop has its own iteration context. Data must be encoded in the work item (its body, metadata) rather than shared between Loops.

## Selection-Reservation Pattern

The most common hybrid chain: a concrete selection Task finds work, a concrete reservation Task claims it, an AI or concrete Work Task processes it, and finalization closes it.

```
Task 1 (selection + reservation, concrete):
  Step 1: query items with label "pick" → output {number, title, body}
  Step 2: transition label from "pick" to "doing"
  → onSuccess: Task 2

Task 2 (work, AI or concrete):
  Processes the item using interpolated context
  → onSuccess: Task 3 (finalization)
  → onFailure: Task 4 (recovery)

Task 3 (finalization, concrete):
  Commits, pushes, transitions label to "pr", creates PR

Task 4 (recovery, concrete):
  Reverts local changes, reverts label to "pick"
```

Steps 1 and 2 within the selection Task execute sequentially. The selection step produces context (the item data). The reservation step consumes that context (the item number) to transition the label. If the selection step finds no work, it exits non-zero — the chain terminates without running the reservation step.

For the empty-work pattern and condition modelling details, see [conditions.md](conditions.md) in the Tasks skill.

## State-Aware Recovery

When a Work Task fails, recovery must restore both the local working state and the external state markers. A recovery that only undoes local changes but leaves the label in `doing` creates an orphaned item that no Loop will select and no recovery will clean up.

### Recovery sequence

1. **Undo local changes**: reset the working directory to a clean state. Remove untracked files.
2. **Revert to baseline**: sync with the default branch.
3. **Revert the external marker**: transition the label back to the selection state (`doing` → `pick`).

After recovery, the item is eligible for the next iteration's selection Task. The Loop continues to the next cadence.

### Recovery Task properties

- The recovery Task consumes `{{number}}` (or whatever key identifies the work item) from the context accumulated before the failure.
- The recovery Task is **idempotent**: if the local state is already clean, the reset is a no-op. If the label was already reverted, the transition is a no-op.
- The recovery Task is concrete — it does not invoke an AI agent. Recovery must be deterministic and fast.

For AI-specific recovery patterns (when the Work Task is an AI agent), see [ai-agent-patterns.md](ai-agent-patterns.md).

## Shared Terminal Tasks

Multiple selection Tasks from different Loops can point their `onFailure` to the same silent terminal Task. This is the **empty-work terminator**: when no work exists, the chain terminates quietly.

```
Loop A selection Task → onFailure → silent terminator
Loop B selection Task → onFailure → silent terminator
Loop C selection Task → onFailure → silent terminator
```

The silent terminator (`silentChain: true`) hides the entire run from the right panel when no work is found. Always use on `onFailure` only — never on `onSuccess` of real-work tasks. Every selection Task that uses the empty-work pattern references the same terminator.

For the empty-work iteration pattern and condition modelling, load **`loop-task-tasks`**.
