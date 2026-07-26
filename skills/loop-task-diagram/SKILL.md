---
name: loop-task-diagram
version: 1.0.0
description: >
  Generate ASCII art diagrams of Loop Task recipe YAML files in .loops/recipes/.
  Load when creating, reviewing, or modifying a recipe .yaml file, when a user
  asks to visualize a recipe's task chain, or when the diagram: field needs
  regeneration. Maps the recipe schema (loops, tasks, onSuccessTaskId,
  onFailureTaskId, silentChain) to a text-based flowchart showing the full
  chain with success and failure edges, cycle routing, and terminator nodes.
---

# Loop Task Diagram

A recipe's task graph is its **chain**. Each task in `tasks[]` is a node; each `onSuccessTaskId` and `onFailureTaskId` is an edge. The `loops[].taskId` points at the **entry** node. A task with both edges null is a **terminator**. This skill reads a `.loops/recipes/*.yaml` file, maps its chain to ASCII glyphs, chooses a layout, renders the diagram, and writes it back into the `diagram:` field of the same YAML file using AST-preserving round-trips so the rest of the file stays untouched.

## Your task

1. **Read the recipe.** Parse the `.yaml` file. Extract `loops[]`, `tasks[]`. Completion criterion: every task id accounted for, the entry `taskId` identified, every `onSuccessTaskId` and `onFailureTaskId` resolved to a target task or null.

2. **Map the chain to glyphs.** Translate each schema field to its ASCII representation using the glyph map below. Completion criterion: every task, edge, loop entry, and special flag (`silentChain`, non-default `maxRuns`) has a glyph decision.

3. **Choose a layout.** Apply the layout decision tree. Detect cycles before drawing. Completion criterion: a layout type is selected, and if cycles exist, every back-edge has a routing plan along a margin.

4. **Render and write.** Draw the ASCII art. Write it into the `diagram:` field of the `.yaml` file as a YAML block scalar. The `yaml` package's Document API preserves the rest of the file byte-for-byte. Completion criterion: the diagram survives a read-write round-trip, passes every quality gate, and the file still loads in the daemon.

## Leading word: chain

A recipe's task graph is its **chain**. The word `chain` already lives in the loop-task codebase: `chain-executor.ts`, `silentChain`, `chainGroupId`. Reuse it. When you see `onSuccessTaskId`, think "the next link in the chain on success." When you see `silentChain: true`, think "a muted link." The chain has an **entry** (the `loops[].taskId`), **edges** (success and failure links), **glyphs** (the ASCII shapes), and **terminators** (links that lead nowhere).

## Glyph map

Single source of truth for every schema field's ASCII representation.

```
SCHEMA FIELD              GLYPH                                    NOTES
────────────              ─────                                    ────
loops[].taskId            ┄┄> entry node                           dashed prefix edge with label
                          label: intervalHuman, immediate,
                          offset, maxRuns (if non-default)

onSuccessTaskId           ──✓──> target node                       solid line, checkmark
onFailureTaskId           ──✗──> target node                       solid line, x mark

silentChain: true         ╔════════════╗                           dashed border, "(silent)" tag
                          ║ task name  ║                           marks links whose output
                          ╚════════════╝                           should not pollute context

maxRuns (≠ 5)             [maxRuns=N] badge                        appended to node label
                          DEFAULT_TASK_MAX_RUNS = 5, so only
                          draw the badge when the value differs

steps[]                   ┌─ steps ──────────────────────┐         subgraph box wrapping
                          │ 1. command args...           │         the multi-step commands
                          │ 2. command args...           │         inside the task node
                          └──────────────────────────────┘

terminal (both edges      (( end ))
onSuccess+onFailure       or (( <task-id> ))
are null)                                                         rounded double parens

back-edge (cycle)         ┄┄↻┄┄ back to <task-id>                   dashed line with ↻ glyph
                                                                  routed along left margin
```

## Layout decision tree

Choose the layout before drawing any boxes. Detect cycles first.

```
LINEAR CHAIN (≤4 tasks, no branching)
  → top-down column, single lane
  → entry at top, terminators at bottom
  → edges drawn as vertical lines with ✓/✗ labels

BRANCHING (any task has both success and failure edges non-null)
  → two-lane layout
  → left lane: success path (✓ edges)
  → right lane: failure path (✗ edges)
  → entry at top center, lanes diverge below the branching task

CYCLIC (any task's edge points to a task already on the current path)
  → detect via DFS before layout
  → forward path drawn top-down as normal
  → back-edges routed along the LEFT margin (see cyclic routing rules)
  → never route a back-edge through a box

LARGE (>12 tasks)
  → split into overview + per-entry detail diagrams
  → overview shows entry, major branches, terminators
  → detail diagrams expand each sub-chain
```

## Cyclic routing rules

Cycles are the hard layout problem. A back-edge (a task's edge pointing to a node already drawn above it) must route around existing boxes, never through them.

```
BEFORE LAYOUT:
  1. Run DFS on the task graph.
  2. Flag every edge that points to a node already on the current
     discovery path as a back-edge.
  3. Count back-edges. If >3, split into multiple diagrams.

ROUTING:
  4. Draw the forward path top-down, as normal.
  5. For each back-edge:
     a. Exit the source node from its LEFT side.
     b. Travel UP along the left margin.
     c. Enter the target node from its LEFT side.
     d. Mark the line with ↻ glyph at its midpoint.
  6. NEVER cross a box with a return line.
  7. If two back-edges would collide on the left margin,
     offset the second one 2 columns further left.
  8. If a back-edge cannot route without crossing >3 boxes,
     abandon single-diagram layout and split into overview + detail.

EXAMPLE (A → B → C → A):

    ┌─────┐     ┌─────┐
    │  A  │────▶│  B  │
    └──┬──┘     └─────┘
       ▲              │
       │↻             ▼
       │         ┌─────┐
       │         │  C  │
       │         └──┬──┘
       │            │
       └────────────┘
         left margin return,
         does not cross B or C
```

## Quality gates

Check every gate before writing the `diagram:` field. All must pass.

- [ ] Every task in `tasks[]` has a node in the diagram
- [ ] Every non-null `onSuccessTaskId` has a solid `──✓──>` edge
- [ ] Every non-null `onFailureTaskId` has a solid `──✗──>` edge
- [ ] The `loops[].taskId` entry edge is drawn as `┄┄>` and labeled with `intervalHuman`, `immediate`, `offset`, or `maxRuns` if present
- [ ] Tasks with `silentChain: true` have a dashed border and `(silent)` tag
- [ ] Tasks with non-default `maxRuns` (≠ 5) have a `[maxRuns=N]` badge
- [ ] Terminal tasks (both edges null) end in `(( end ))` or `(( <task-id> ))`
- [ ] All back-edges are routed along the left margin with a `↻` glyph
- [ ] No line crosses through a box
- [ ] Diagram width ≤ 80 characters

## Worked examples

### Example 1: linear chain (issue-oldest.yaml)

```yaml
loops:
  - taskId: list-issues
    intervalHuman: "0"
    description: List all repo issues (open + closed), print the oldest
tasks:
  - id: list-issues
    onSuccessTaskId: print-oldest
    onFailureTaskId: null
  - id: print-oldest
    onSuccessTaskId: null
    onFailureTaskId: null
```

Expected `diagram:` output:

```
diagram: |
  ┌─────────────┐       ┌─────────────┐
  │ list-issues │──✓──▶│ print-oldest │──▶ (( end ))
  └─────────────┘       └─────────────┘
```

### Example 2: branching with silent chain (issue-count-silent-check.yaml)

```yaml
loops:
  - taskId: fetch-issues
    intervalHuman: 10s
    maxRuns: 10000
tasks:
  - id: fetch-issues
    onSuccessTaskId: report
    onFailureTaskId: log-silent-error
  - id: report
    onSuccessTaskId: null
    onFailureTaskId: null
  - id: log-silent-error
    silentChain: true
    onSuccessTaskId: null
    onFailureTaskId: null
```

Expected `diagram:` output:

```
diagram: |
  ┌───────────────┐ [maxRuns=10000]
  │ fetch-issues  │
  └──────┬────────┘
         │
    ┌────┴────┐
    ✓         ✗
    │         │
    ▼         ▼
  ┌─────────┐ ╔════════════════╗ (silent)
  │ report  │ ║ log-silent-    ║
  └────┬────┘ ║ error           ║
       │      ╚════════┬═══════╝
       ▼               ▼
     (( end ))       (( end ))
```

### Example 3: cyclic chain (synthetic)

```yaml
loops:
  - taskId: poll
    intervalHuman: 30s
tasks:
  - id: poll
    onSuccessTaskId: process
    onFailureTaskId: retry
  - id: process
    onSuccessTaskId: null
    onFailureTaskId: retry
  - id: retry
    onSuccessTaskId: poll
    onFailureTaskId: null
```

Expected `diagram:` output:

```
diagram: |
  ┌───────┐       ┌─────────┐
  │ poll  │──✓──▶│ process │
  └──┬────┘       └────┬────┘
     │ ✗               │ ✗
     │                 │
     │          ┌──────▼──────┐
     │          │   retry     │
     │          └──────┬──────┘
     │                 │ ✓
     ▼↻                │
     └─────────────────┘
       back-edge routed along
       left margin, does not
       cross process or retry
```

## Output contract

The skill writes the `diagram:` field inside the `.yaml` recipe file itself. The diagram is not a separate file; it is a real property of the recipe document, stored as a YAML block scalar (`|`).

```
LOOPS/RECIPES/ISSUE-OLDEST.YAML
┌──────────────────────────────────────────┐
│ version: 2                               │
│                                          │
│ loops:                                   │ ← daemon reads
│   - taskId: list-issues                  │
│     intervalHuman: "0"                   │
│                                          │
│ tasks:                                   │ ← daemon reads
│   - id: list-issues                      │
│     onSuccessTaskId: print-oldest       │
│   - id: print-oldest                     │
│     ...                                  │
│                                          │
│ diagram: |                               │ ← skill writes
│   ┌─────────────┐   ┌─────────────┐      │
│   │ list-issues │──▶│ print-oldest │      │
│   └─────────────┘   └─────────────┘      │
└──────────────────────────────────────────┘
```

**How to write:** Use the `yaml` package's `parseDocument()` to load the file as an AST. Set the `diagram` key to a block scalar containing the ASCII art. Call `String(doc)` to write back. The AST-preserving round-trip keeps every other field, comment, and formatting choice byte-for-byte.

**When to regenerate:** After creating a new recipe, after editing any task's `onSuccessTaskId`, `onFailureTaskId`, `silentChain`, `maxRuns`, or `steps[]`, or when the `diagram:` field is missing or stale. The daemon's `file-writer.ts` uses the same AST-preserving approach for override writes, so a runtime override to `intervalHuman` or `maxRuns` will not destroy the `diagram:` field.

## Not-for boundaries

Do not use this skill for:

- Mermaid, SVG, or rendered graphics. This skill produces ASCII art only, stored as a YAML block scalar.
- Live loop state. The TUI board shows runtime status; this skill shows static recipe structure.
- Editing recipes. This skill is read-only for every field except `diagram:`. It never touches `loops[]`, `tasks[]`, or any data field.
- Tasks outside `.loops/recipes/`. Normal loops (created via `loop-task new`) do not have recipe files and are not diagrammed here.
- Photo editing, UI mockups, or interactive diagrams. This is text art in a YAML file.

## Cross-Skill References

- For Loop cadence, iteration scheduling, and recipe file schema, load **`loop-task-loops`**. It tells you how to compose a Loop and write it as a `.loops/recipes/*.yaml` file.
- For Task execution, chaining, context, and success/failure edges, load **`loop-task-tasks`**. It defines the `onSuccessTaskId` and `onFailureTaskId` fields this skill diagrams.
- For Project organisation, load **`loop-task-projects`**.
