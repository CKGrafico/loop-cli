# Task Design Patterns

## 1. Select-Then-Process

**Problem**: Find eligible work and process it, handling the case where no work exists.

```
select-work:
  purpose: Find one eligible work item
  on-success: process-work
  on-failure: none (no work found — clean exit)

process-work:
  purpose: Execute the work
  consumes: { itemId, itemData }
  on-success: finalize-work
  on-failure: recover-work
```

"No work" is failure with no `onFailure`. The selection Task produces context (item IDs) that the processing Task consumes.

---

## 2. Inspect-Change-Verify

**Problem**: Modify external state safely by checking first and validating afterward.

```
inspect:
  purpose: Read current state and determine whether a change is needed
  produces: { currentState, needsChange }
  on-success: perform-change
  on-failure: none (no change needed)

perform-change:
  purpose: Apply the change
  consumes: { currentState }
  produces: { changeId }
  on-success: verify-change
  on-failure: report-failure

verify-change:
  purpose: Read the state again and confirm the change took effect
  consumes: { changeId, currentState }
  on-success: finalize
  on-failure: report-failure

report-failure:
  purpose: Notify that the change failed
  on-success: none
  on-failure: none
```

Inspect before changing. Verify after changing. The report-failure Task is shared by both change and verification failures.

---

## 3. Reserve-Process-Finalize

**Problem**: Claim exclusive ownership of a work item before processing it.

```
select-item:
  purpose: Find one eligible work item
  produces: { itemId }
  on-success: reserve-item
  on-failure: none (no eligible items)

reserve-item:
  purpose: Mark the item as "in progress"
  consumes: { itemId }
  on-success: process-item
  on-failure: none (item already reserved)

process-item:
  purpose: Perform the actual work
  consumes: { itemId }
  produces: { resultSummary }
  on-success: finalize-item
  on-failure: release-item

finalize-item:
  purpose: Mark the item as completed
  consumes: { itemId }
  on-success: none
  on-failure: none

release-item:
  purpose: Remove the "in progress" mark and report the failure
  consumes: { itemId }
  on-success: none
  on-failure: none
```

Reservation prevents duplicate processing. Release on failure ensures the item is not stuck. The `release-item` Task must be idempotent.

---

## 4. Try-Recover

**Problem**: Attempt an operation and recover on failure.

```
attempt-operation:
  purpose: Try the primary operation
  produces: { operationId }
  on-success: continue-chain
  on-failure: recover-operation

recover-operation:
  purpose: Undo partial effects and restore a clean state
  consumes: { operationId }
  on-success: none (recovered — iteration terminates)
  on-failure: escalate-failure

escalate-failure:
  purpose: Notify that recovery also failed
  on-success: none
  on-failure: none
```

After successful recovery, the chain terminates. Retry logic would require a cycle (recover → attempt), which is dangerous. Use the Loop's next iteration instead.

---

## 5. Gate Task (Context-Aware Routing)

**Problem**: Route based on a value that already exists in the iteration context.

```
collect-data:
  purpose: Query an external system and emit structured info
  produces: { severity, itemCount, lastModified }
  on-success: route-on-severity
  on-failure: none

route-on-severity:
  purpose: Read severity from context and exit accordingly
  consumes: { severity }
  # Internally: if severity == "critical" then exit 0; else exit 1
  on-success: handle-critical
  on-failure: handle-non-critical
```

The gate Task reads context and exits with a code that reflects the desired routing. This is the **only** way to route based on context values.

---

## 6. Shared Notification Task

**Problem**: Multiple paths in a chain need the same type of notification.

```
step-a:
  on-success: step-b
  on-failure: notify-failure

step-b:
  on-success: step-c
  on-failure: notify-failure

step-c:
  on-success: none
  on-failure: notify-failure

notify-failure:
  purpose: Send a failure notification
  on-success: none
  on-failure: none
```

A single notification Task is referenced by multiple predecessors. It receives context accumulated up to the point of failure. Consider adding a `failureSource` context key at each predecessor so the notification can identify where the failure occurred.

---

## 7. Multi-Step Task

**Problem**: Execute multiple commands within a single Task, where later steps depend on earlier ones and commands within a step run in parallel.

```
task:
  steps:
    - step-1:
        commands:
          - command: "fetch-data-source-a"
          - command: "fetch-data-source-b"
        # Both run in parallel. Step fails if either fails.

    - step-2:
        commands:
          - command: "merge-and-transform"
          # Sequential. Receives stdout from step 1.

    - step-3:
        commands:
          - command: "validate-output"
```

Steps run sequentially. Commands within a step run in parallel. If any command in a step fails, subsequent steps are skipped. For simple linear chains, prefer separate Tasks with `onSuccess` chains for observability.

---

## 8. Silent Chain Task

**Problem**: A "no work found" task that should not clutter the run history.

```
nothing-to-do:
  purpose: Terminate when no work exists
  silentChain: true
  on-success: none
  on-failure: none
```

`silentChain: true` hides the entire run from the right panel when this task executes. Only use on `onFailure` paths (e.g. when a selection task finds no issues). Never set a silent task as the `onSuccess` of real-work tasks — it would hide runs that did meaningful work.

---

## 9. Context-Forwarding Chain

**Problem**: Each Task produces a piece of data that the final Task needs.

```
collect-repo-info:
  purpose: Gather repository metadata
  produces: { repoName, branchName, latestCommit }
  on-success: collect-issue-info
  on-failure: none

collect-issue-info:
  purpose: Gather issue metadata
  produces: { issueNumber, issueTitle }
  on-success: synthesize
  on-failure: none

synthesize:
  purpose: Combine all collected information into a report
  consumes: { repoName, branchName, latestCommit, issueNumber, issueTitle }
  produces: { reportPath }
  on-success: none
  on-failure: none
```

Context accumulates across the chain. The final Task sees all previously produced keys. Use **named JSON keys** (not `output`) for values that must survive across steps.

---

## 10. Conditional Finalization

**Problem**: Finalize work only if the result meets expectations, and recover otherwise.

```
perform-work:
  purpose: Execute the primary operation
  produces: { resultData, resultChecksum }
  on-success: verify-result
  on-failure: recover

verify-result:
  purpose: Check whether the result matches expectations
  consumes: { resultData, resultChecksum }
  # Internally: if checksum matches, exit 0; else exit 1
  on-success: finalize
  on-failure: recover

finalize:
  purpose: Mark the work as completed
  consumes: { resultData }
  on-success: none
  on-failure: none

recover:
  purpose: Undo the work and report the failure
  consumes: { resultData }
  on-success: none
  on-failure: none
```

Verification is a separate Task, not just trusting the exit code. Finalization only happens after independent verification.
