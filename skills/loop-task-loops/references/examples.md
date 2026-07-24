# Loop Examples

All examples use a conceptual YAML-like notation. **This is not a real configuration format.** It illustrates the structure of Loops, Tasks, and their relationships.

---

## Example 1: Repository Synchronization + Work-Item Processing

```yaml
project:
  name: backend-repository

loop:
  purpose: Keep the local repository in sync and process one stale work item
  cadence: Every 20m
  first-iteration: immediate
  maximum-iterations: unlimited
  initial-task: sync-repository

tasks:
  sync-repository:
    purpose: Pull the latest changes from the remote
    produces: { latestCommit, branchName }
    on-success: select-stale-item
    on-failure: none (sync failed - Loop retries next cadence)

  select-stale-item:
    purpose: Find one eligible work item
    consumes: { latestCommit }
    produces: { itemId, itemTitle, itemBody }
    on-success: process-item
    on-failure: none (no stale items)

  process-item:
    purpose: Execute the work
    consumes: { itemId, itemTitle, itemBody, branchName }
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
    purpose: Release the item and report the failure
    consumes: { itemId }
    on-success: none
    on-failure: none

terminal-outcomes:
  success: Repository synced, one item processed and finalized
  failure: Sync failed (Loop retries), or item processing failed (item released, Loop retries)
```

---

## Example 2: Issue Refinement

```yaml
project:
  name: product-delivery

loop:
  purpose: Find one issue that needs refinement and improve its quality
  cadence: Every 20m
  first-iteration: immediate
  maximum-iterations: unlimited
  initial-task: find-refinement-candidate

tasks:
  find-refinement-candidate:
    purpose: Query for an issue labelled "to refine" and extract its data
    produces: { number, title, body }
    on-success: mark-as-refining
    on-failure: none (no issues to refine)

  mark-as-refining:
    purpose: Change the issue label from "to refine" to "refining"
    consumes: { number }
    on-success: refine-with-agent
    on-failure: none (label change failed)

  refine-with-agent:
    purpose: Run an agent to rewrite the issue as a detailed user story
    consumes: { number, title, body }
    produces: { refinedTitle, refinedBody }
    on-success: mark-as-ready
    on-failure: none (agent failed - issue stays in "refining")

  mark-as-ready:
    purpose: Change the issue label from "refining" to "to implement"
    consumes: { number }
    on-success: none
    on-failure: none

terminal-outcomes:
  success: Issue refined and labelled "to implement"
  failure: No issues to refine, or refinement failed at some step
```

---

## Example 3: Issue Implementation

```yaml
project:
  name: product-delivery

loop:
  purpose: Implement one issue from the ready backlog
  cadence: Every 1h
  first-iteration: delayed (wait for cadence alignment)
  maximum-iterations: 8 per day
  initial-task: find-implementable-issue

tasks:
  find-implementable-issue:
    purpose: Find a "to implement" issue
    produces: { number, title, body }
    on-success: mark-as-implementing
    on-failure: none (no issues to implement)

  mark-as-implementing:
    purpose: Change the label from "to implement" to "implementing"
    consumes: { number }
    on-success: implement-with-agent
    on-failure: none

  implement-with-agent:
    purpose: Run an agent to code the implementation
    consumes: { number, title, body }
    produces: { implementationResult }
    on-success: verify-implementation
    on-failure: recover-issue

  verify-implementation:
    purpose: Confirm the changes are merged to main and synced
    consumes: { number, implementationResult }
    on-success: close-issue
    on-failure: recover-issue

  close-issue:
    purpose: Close the issue after successful implementation
    consumes: { number }
    on-success: none
    on-failure: none

  recover-issue:
    purpose: Remove the "implementing" label and report the failure
    consumes: { number }
    on-success: none
    on-failure: none

terminal-outcomes:
  success: Issue implemented, verified, and closed
  failure: No issues to implement, or implementation failed (issue label reverted)
```

---

## Example 4: Health Monitoring with Recovery

```yaml
project:
  name: service-operations

loop:
  purpose: Monitor a service endpoint and attempt recovery on failure
  cadence: Every 5m
  first-iteration: immediate
  maximum-iterations: unlimited
  initial-task: check-health

tasks:
  check-health:
    purpose: Verify the target endpoint responds successfully
    produces: { responseTime, statusCode }
    on-success: none (healthy - iteration terminates)
    on-failure: attempt-restart

  attempt-restart:
    purpose: Trigger a service restart
    produces: { restartInitiated }
    on-success: verify-recovery
    on-failure: notify-oncall

  verify-recovery:
    purpose: Wait briefly and check health again after restart
    consumes: { restartInitiated }
    produces: { responseTime, statusCode }
    on-success: none (recovered)
    on-failure: notify-oncall

  notify-oncall:
    purpose: Alert the on-call team that recovery failed
    on-success: none
    on-failure: none

terminal-outcomes:
  success: Service is healthy (no action needed), or restarted and recovered
  failure: Health check failed, restart failed, on-call notified
```

---

## Example 5: Multi-Loop Pipeline (Refine + Implement)

Two Loops coordinating through shared labels. The refine Loop produces issues labelled `code:pick`. The implement Loop consumes them.

```yaml
project:
  name: product-delivery

# Loop A: Refine
loop-a:
  purpose: Find one issue needing refinement and improve its quality
  cadence: Every 20m
  initial-task: find-refinement-candidate

# Loop B: Implement
loop-b:
  purpose: Implement one refined issue
  cadence: Every 1h
  initial-task: find-implementable-issue

# The handoff: Loop A's finalization Task labels the issue "code:pick".
# Loop B's selection Task queries for items labelled "code:pick".
# Each Loop runs independently at its own cadence.
# They coordinate through the label, never directly.
```

---

## Example 6: Bounded Deployment Polling

```yaml
project:
  name: software-delivery

loop:
  purpose: Wait for a deployment to reach a healthy state
  cadence: Every 10s
  first-iteration: immediate
  maximum-iterations: 60 (poll for up to 10 minutes)
  initial-task: check-deployment-status

tasks:
  check-deployment-status:
    purpose: Query the deployment's current health
    produces: { deploymentState, version }
    on-success: none (deployment is healthy)
    on-failure: none (not yet healthy - Loop retries)

terminal-outcomes:
  success: Deployment became healthy within the iteration limit
  failure: Deployment did not become healthy within 60 iterations
```
