# Loop Design Patterns

## 1. Periodic Health Check

**Problem**: Verify a service remains healthy at regular intervals.

```
Loop:
  cadence: Every 5m
  immediate: true
  initial-task: check-health

Tasks:
  check-health:
    purpose: Evaluate health of the target service
    produces: nothing (or structured health data)
    on-success: none (healthy - iteration terminates)
    on-failure: alert

  alert:
    purpose: Notify operators of the failure
    produces: nothing
    on-success: none
    on-failure: none
```

The alert Task only executes on failure. The Loop continues to next iteration regardless of outcome.

---

## 2. Periodic Synchronization

**Problem**: Keep a local or remote resource in sync with an upstream source.

```
Loop:
  cadence: Every 1h
  initial-task: detect-changes

Tasks:
  detect-changes:
    purpose: Check whether synchronization is needed
    produces: { hasChanges, lastSyncTimestamp }
    on-success: perform-sync
    on-failure: none (no changes - clean exit)

  perform-sync:
    purpose: Execute the synchronization
    consumes: { lastSyncTimestamp }
    produces: { syncId, syncedCount }
    on-success: verify-sync
    on-failure: report-sync-failure

  verify-sync:
    purpose: Confirm the synchronization succeeded
    consumes: { syncId }
    on-success: finalize-sync
    on-failure: report-sync-failure

  report-sync-failure:
    purpose: Notify that synchronization failed
    consumes: { syncId, syncedCount }
    on-success: none
    on-failure: none
```

"No changes needed" is success with no `onSuccess` - a clean exit.

---

## 3. Process One Backlog Item Per Iteration

**Problem**: Progress through a backlog by processing one eligible item per iteration.

```
Loop:
  cadence: every 20m
  immediate: true
  initial-task: select-item

Tasks:
  select-item:
    purpose: Find one eligible work item
    produces: { itemId, itemTitle, itemBody }
    on-success: reserve-item
    on-failure: none (no eligible items - clean exit)

  reserve-item:
    purpose: Mark the item as in-progress
    consumes: { itemId }
    on-success: process-item
    on-failure: none (item taken by another process)

  process-item:
    purpose: Execute the actual work
    consumes: { itemId, itemTitle, itemBody }
    produces: { resultSummary }
    on-success: verify-result
    on-failure: recover-item

  verify-result:
    purpose: Confirm the work was completed
    consumes: { itemId, resultSummary }
    on-success: finalize-item
    on-failure: recover-item

  finalize-item:
    purpose: Mark the item as completed
    consumes: { itemId }
    on-success: none
    on-failure: none

  recover-item:
    purpose: Release the reservation and report the failure
    consumes: { itemId }
    on-success: none
    on-failure: none
```

Selection and reservation are separate. "No work found" is failure with no successor.

---

## 4. Bounded Polling

**Problem**: Wait for a condition with a maximum number of attempts.

```
Loop:
  cadence: Every 10s
  maxRuns: 30
  initial-task: check-condition

Tasks:
  check-condition:
    purpose: Evaluate whether the condition is satisfied
    produces: { currentState }
    on-success: none (condition met)
    on-failure: none (not yet met - Loop retries)
```

After 30 attempts, the Loop pauses. For "stop on first success", set `maxRuns: 1`.

---

## 5. Safe Maintenance

**Problem**: Perform a maintenance operation safely by inspecting first and validating afterward.

```
Loop:
  cadence: Every 1d
  initial-task: inspect-state

Tasks:
  inspect-state:
    purpose: Examine current state and determine whether maintenance is needed
    produces: { needsMaintenance, currentState }
    on-success: perform-maintenance
    on-failure: none (no maintenance needed)

  perform-maintenance:
    purpose: Execute the maintenance change
    consumes: { currentState }
    produces: { changeId }
    on-success: validate-maintenance
    on-failure: report-failure

  validate-maintenance:
    purpose: Verify the maintenance achieved the expected result
    consumes: { changeId }
    on-success: none
    on-failure: report-failure

  report-failure:
    purpose: Notify that maintenance failed validation
    consumes: { changeId }
    on-success: none
    on-failure: none
```

Inspect before changing. Validate after changing.

---

## 6. Agent Execution Loop

**Problem**: Have an AI agent process work on a cadence with structured context passing.

```
Loop:
  cadence: every 20m
  immediate: true
  initial-task: collect-context

Tasks:
  collect-context:
    purpose: Gather structured information about the work to perform
    produces: { workId, workTitle, workBody, repositoryState }
    on-success: prepare-prompt
    on-failure: none (no work available)

  prepare-prompt:
    purpose: Construct the agent's input from collected context
    consumes: { workId, workTitle, workBody, repositoryState }
    produces: { agentPrompt }
    on-success: execute-agent
    on-failure: none

  execute-agent:
    purpose: Run the agent with the constructed prompt
    consumes: { agentPrompt, workId }
    produces: { agentResult }
    on-success: verify-completion
    on-failure: recover-work

  verify-completion:
    purpose: Independently verify the agent produced the expected result
    consumes: { workId, agentResult }
    on-success: finalize-work
    on-failure: recover-work

  finalize-work:
    purpose: Mark the work as completed
    consumes: { workId }
    on-success: none
    on-failure: none

  recover-work:
    purpose: Release the work item and report the failure
    consumes: { workId }
    on-success: none
    on-failure: none
```

Context is collected before the agent runs. Verification is independent.

---

## 7. Empty-Work Iteration

**Problem**: Handle the common case where a Loop's selection Task finds no work.

```
Loop:
  cadence: Every 1h
  initial-task: find-work

Tasks:
  find-work:
    purpose: Check whether eligible work exists
    produces: nothing (no context needed when there is no work)
    on-success: process-work (work found)
    on-failure: none (no work found - chain terminates, Loop waits)
```

When "no work" is a normal, expected state, represent it as **failure with no `onFailure`**. The iteration terminates cleanly and the Loop waits for the next cadence.

Using success for "no work" causes the chain to continue to `onSuccess`, which expects work. Using failure with a recovery path triggers recovery on every idle iteration.
