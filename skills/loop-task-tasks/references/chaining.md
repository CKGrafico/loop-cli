# Chaining Model Reference

## Chain as a Linked List

A chain is a **linked list with two transitions** at each node. Each Task has at most two outgoing edges: one for success (`onSuccessTaskId`) and one for failure (`onFailureTaskId`).

The chain is **not** a DAG, a tree, or a general graph - because cycles are possible (though dangerous). It is **not** a workflow engine: no conditional branches beyond success/failure, no joins, no parallel splits, no timers, no event gates.

## Truth Table: Successor Selection

| Task result | onSuccess | onFailure | Outcome |
|---|---|---|---|
| Success | Present | Any | Execute onSuccess Task |
| Success | Absent | Any | Chain terminates |
| Failure | Any | Present | Execute onFailure Task |
| Failure | Any | Absent | Chain terminates |

When both successors are absent, the chain **always** terminates after the Task.

## Chain Execution Sequence

1. A Task executes and produces a result (exit code).
2. If stdout is captured, it is parsed and merged into the iteration context via `Object.assign`.
3. Based on the result, the appropriate successor is determined.
4. If a successor exists, its command and arguments are interpolated with the current context.
5. The successor Task executes. Return to step 1.
6. If no successor exists (or the referenced successor does not exist), the chain terminates.
7. The iteration's final exit code is the exit code of the last Task that executed.

## Context Accumulation

Context accumulates across the entire chain within one iteration. Each Task's parsed stdout is merged into the same context object. Later values overwrite earlier values for the same key. The `output` key is overwritten every time a Task produces plain-text output.

Context survives across **success and failure transitions**. A recovery Task can read context produced by the Task that failed.

## Failure Propagation

A Task failure does **not** automatically propagate as an iteration failure. When a Task fails and `onFailure` is defined, the chain continues with the recovery Task.

The iteration's final exit code is determined by the **last** Task that executed:

| Chain flow | Final exit code | Iteration result |
|---|---|---|
| Task A fails → no onFailure | Task A's exit code | Failure |
| Task A fails → recovery succeeds → no onSuccess | Recovery's exit code (0) | Success |
| Task A fails → recovery fails → no onFailure | Recovery's exit code | Failure |
| Task A succeeds → Task B fails → recovery succeeds | Recovery's exit code (0) | Success |

## Shared Successors

Multiple predecessor Tasks can reference the same successor Task:

- Shared finalisation Task: multiple work Tasks point to the same "finalize" Task on success.
- Shared recovery Task: multiple Tasks point to the same "notify-failure" Task on failure.
- Shared notification Task: any failure path routes to a single alert mechanism.

Shared successors receive the context accumulated up to the point of transition. They do not know which predecessor invoked them (unless context identifies the source).

## Cycles

```
Task A --onSuccess--> Task B --onSuccess--> Task C --onSuccess--> Task A
```

Or a self-reference: `Task A --onSuccess--> Task A`.

Loop Task does **not** validate against cycles. A cycle causes the chain to execute the same Tasks in an infinite loop within one iteration. The iteration never terminates.

**Cycle prevention is the designer's responsibility.** Never set a Task's successor to point to itself. Never create a circular chain of references. When designing chains, draw the graph and verify it is acyclic. Use shared successors instead of cycles - if Task C needs to redo Task A's work, create a separate Task D that performs the redo.

## Termination

A chain terminates when:

1. **No matching successor**: the Task's result has no corresponding transition defined.
2. **Missing successor reference**: the referenced Task ID does not exist (deleted or never created). The chain terminates silently.
3. **External abort**: the iteration is stopped, paused, or the runtime shuts down.

A chain does **not** terminate on:
- A Task failure (if `onFailure` is defined)
- A Task success (if `onSuccess` is defined)
- Context key collisions (values are silently overwritten)
