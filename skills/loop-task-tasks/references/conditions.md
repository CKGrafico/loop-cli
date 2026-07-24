# Conditions Reference

## Verified Condition Model

Loop Task has **no** first-class Condition entity. No `Condition` types, no conditional expressions, no switch/case routing. The **only** native routing mechanism is Task result semantics:

1. A Task evaluates the condition.
2. Success (exit code 0) selects `onSuccess`.
3. Failure (exit code non-zero) selects `onFailure`.

## Three Concepts to Distinguish

### 1. Domain condition

A real-world decision: does work exist, are tests passing, is the deployment healthy, is the branch synchronized, does approval exist.

### 2. Task evaluation

The Task's executable payload evaluates the condition by checking external state and exiting with the appropriate code.

### 3. Transition result

The Task expresses the outcome as success or failure, selecting one of the two available transitions.

## Condition Use Cases

### Continue only when work exists

```
selection-task:
  purpose: Find one eligible work item
  on-success: process-work
  on-failure: none (no work - chain terminates, Loop waits for next cadence)
```

### Continue only when synchronization is needed

```
check-sync:
  purpose: Compare local and remote state
  produces: { needsSync, lastSyncTimestamp }
  on-success: perform-sync
  on-failure: none (already synchronized - chain terminates)
```

### Route to recovery when validation fails

```
validate:
  purpose: Check whether the result meets expectations
  produces: { validationErrors }
  on-success: finalize
  on-failure: recover-or-report
```

### Terminate without action when no work exists

```
find-work:
  purpose: Check whether eligible work exists
  on-success: do-work
  on-failure: none
```

### Route different outcomes through success and failure

```
health-check:
  purpose: Evaluate service health
  on-success: none (healthy - chain terminates)
  on-failure: attempt-recovery
```

## Limitation: Two Result Channels

A Task produces exactly one of two results. The binary model cannot directly represent tri-state conditions (e.g., "healthy / degraded / down").

### Workaround 1: Two successive Tasks

The first Task distinguishes between two states. The second (reached via a transition) distinguishes the remaining states:

```
check-health:
  purpose: Is the service healthy?
  on-success: none (healthy)
  on-failure: check-degraded

check-degraded:
  purpose: Is the service degraded or down?
  on-success: notify-degraded
  on-failure: notify-down
```

### Workaround 2: Context-based routing with a gate Task

Encode the state in the Task's stdout as context, and have a downstream "gate" Task read and act on it:

```
health-check:
  purpose: Evaluate health and emit status
  produces: { healthStatus: "healthy" | "degraded" | "down" }
  on-success: route-on-status (always succeeds)
  on-failure: notify-down (internal error)

route-on-status:
  purpose: Read healthStatus from context and exit accordingly
  consumes: { healthStatus }
  # Internally: if healthStatus == "critical" then exit 0; else exit 1
  on-success: handle-critical
  on-failure: handle-non-critical
```

Routing still depends on the exit code, not context values. The gate Task embeds its routing logic in its executable payload.

## What Conditions Are Not

| Concept | Does not exist |
|---|---|
| First-class Condition entity | No `Condition` type exists |
| Arbitrary conditional expressions | Only success/failure of a Task |
| Switch/case routing | Only two transitions per Task |
| Routing from context values | Depends on exit code, not context contents |
| Multiple outgoing transitions | At most one successor per result |
| Conditional guards on transitions | Transition is always followed when defined |
| Predicates on context keys | Use a gate Task that reads context and exits accordingly |

## Recommended Practices

1. **Design selection Tasks explicitly for condition evaluation.** "Find work" should succeed when work is found, fail when it is not.

2. **Separate condition evaluation from action.** One Task checks the condition, another acts on it.

3. **Use failure-without-onFailure for "no work" states.** The quietest and most correct representation of "nothing to do."

4. **Avoid using success to mean "nothing to do" when a successor is defined.** If `onSuccess` points to a "process work" Task, succeeding with no work causes the successor to execute on empty data.

5. **Make condition Tasks produce structured context on success.** Emit the data the successor needs (IDs, titles, state) so it does not need to re-query.

6. **Do not rely on context values for routing.** Loop Task routes by exit code. If you need context-aware routing, use a gate Task.
