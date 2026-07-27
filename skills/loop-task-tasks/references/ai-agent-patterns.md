# AI Agent Task Patterns

## The Scaffold

An AI Task - one whose executable payload invokes an agent or language model - is expensive, stochastic, and slow. The Tasks around it are cheap, deterministic, and fast. The **scaffold** is the frame of concrete Tasks that surrounds an AI Task: they feed it structured context, and they finalize or revert its output. The AI Task does the judgment work; the scaffold handles state.

A well-scaffolded AI Task never fetches its own inputs. A selection Task before it produces `{{number}}`, `{{title}}`, `{{body}}` via stdout. The AI Task interpolates those keys into its payload. The AI Task never manages external state - finalization Tasks after it handle labels, commits, pushes, PRs.

## Hybrid Chain Shape

The canonical hybrid chain has five positions, each a separate Task:

| Position | Type | Purpose | Produces |
|---|---|---|---|
| Selection | Concrete | Query for eligible work | `number`, `title`, `body` |
| Reservation | Concrete | Claim the work item (transition its state marker) | Nothing (or confirmation) |
| Work | AI | Perform the judgment-heavy task | Result summary (optional) |
| Verification | Concrete | Independently check the expected result | Nothing |
| Finalization | Concrete | Commit, label transition, PR creation | Nothing |
| Recovery | Concrete | Revert state, put item back in queue | Nothing |

Selection and reservation are often **steps** within one Task (step 1 queries, step 2 transitions the label). The AI Work Task is always its own Task - it is the branch point: success routes to finalization, failure routes to recovery.

## Why Separate Selection from Work

Feeding a vague natural-language instruction to an AI agent ("search for the next issue and implement it") costs tokens for the agent to search, costs latency for the search round-trip, and costs reliability - the agent may find the wrong item, format it differently, or miss it. A concrete selection Task costs milliseconds, produces structured JSON, and the AI Task receives it via interpolation.

The pattern:

```
Task 1 (concrete): query work items, output JSON → context {number, title, body}
Task 2 (AI):      "Implement issue {{number}}: {{title}}. Body: {{body}}"
Task 3 (concrete): commit, push, create PR
```

Each Task's stdout is parsed into context. The AI Task interpolates those keys. The concrete Tasks bookend the AI work.

## AI Task Success Criteria

An AI Task must translate its domain outcome into the process exit code:

- **Exit 0**: the agent completed its work successfully.
- **Exit non-zero**: the agent failed, produced invalid output, or encountered an unrecoverable error.

The agent's executable payload determines this. If the agent runs to completion but the result is wrong, the Task must still exit non-zero - the finalization chain must verify independently, not trust the agent's self-assessment. A verification Task after the AI Task (concrete, checking the result) catches silent failures.

## Context Passing to AI Tasks

The AI Task receives context through the same `{{key}}` interpolation as any Task. The selection Task's stdout (JSON) becomes context keys. The AI Task's payload references them.

Effective context keys for AI Tasks:

| Key | Source | Example use in AI payload |
|---|---|---|
| `number` | Selection Task stdout | Reference the work item |
| `title` | Selection Task stdout | Describe the objective |
| `body` | Selection Task stdout | Provide the full specification |
| `resultSummary` | Prior AI Task stdout | Chain AI Tasks sequentially |
| `output` | Auto-captured stdout+stderr of previous task | "Fix errors: {{output}}" |

Keep the AI payload focused on the interpolated values. The agent receives structured data, not a vague re-description of what to search for.

## AI Task Placement

Place the AI Task at the branch point of the chain. Everything before it is concrete (scaffold). Everything after it depends on its result:

```
Selection (concrete) → Reservation (concrete) → AI Work → Verification → Finalization (concrete)
                                                       ↘ failure       → Recovery (concrete)
```

The AI Task is the only Task that can fail unpredictably. The scaffold absorbs that failure: recovery reverts external state and returns the item to the queue.

Every AI Task also needs a timeout and retry policy. Retry transient runner or network failures only. Route invalid output, failed verification, and repository-state errors to recovery without retrying blindly.

## Recovery for AI Tasks

AI Tasks fail more often than concrete Tasks - the agent may produce broken code, misunderstand the objective, or time out. Recovery must be **state-aware**: revert the external markers the reservation Task set, undo local changes, and return the work item to its pre-reservation state.

Recovery sequence:

1. Undo local changes (working directory reset, untracked file removal).
2. Revert the reservation's state marker (label transition back to the selection state).
3. Return to a clean baseline (sync with the default branch).

After recovery, the item is eligible for the next iteration's selection Task. The Loop continues to the next cadence.

Recovery must be idempotent. Releasing an already released item, restoring an already clean worktree, or repeating an already completed local cleanup should succeed without creating a second side effect.

## When to Use an AI Task vs a Concrete Command

| Work type | Use |
|---|---|
| Querying, filtering, sorting items | Concrete |
| State transitions (labels, statuses) | Concrete |
| File operations (add, commit, push) | Concrete |
| Creating PRs, issues, comments | Concrete |
| Writing code from a specification | AI |
| Refining or rewriting text | AI |
| Auditing, reviewing, scoring | AI |
| Designing a solution from requirements | AI |

The test: if the work is deterministic and has a direct executable, use a concrete Task. If the work requires judgment, language understanding, or creative output, use an AI Task. When using an AI Task, scaffold it - selection before, finalization after, recovery on failure.

## Multi-Step AI Chains

When multiple AI Tasks chain sequentially, each produces context for the next. The first AI Task refines the input; the second consumes the refined input and produces the final output. Keep the chain short - each AI Task adds latency and failure surface.

```
AI Task 1: "Refine issue {{number}}: {{title}}. Body: {{body}}"
  → produces {refinedTitle, refinedBody}

AI Task 2: "Implement {{refinedTitle}}. Specification: {{refinedBody}}"
  → produces {resultSummary}
```

Context accumulates across the chain. Later AI Tasks see all earlier context keys. Use named JSON keys (not the `output` key) for values that must survive across AI Tasks.
