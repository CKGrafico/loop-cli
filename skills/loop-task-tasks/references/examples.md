# Task Examples

All examples use a conceptual YAML-like notation. **This is not a real configuration format.**

---

## Example 1: File Backup with Verification

```yaml
tasks:
  check-source:
    purpose: Verify the source file exists and is readable
    produces: { sourcePath, sourceSize }
    on-success: copy-file
    on-failure: none (source missing)

  copy-file:
    purpose: Copy the source to the backup location
    consumes: { sourcePath }
    produces: { backupPath, copiedSize }
    on-success: verify-copy
    on-failure: none

  verify-copy:
    purpose: Compare the backup against the source
    consumes: { sourceSize, copiedSize }
    on-success: finalize-backup
    on-failure: none

  finalize-backup:
    purpose: Record the successful backup
    consumes: { backupPath, copiedSize }
    on-success: none
    on-failure: none
```

---

## Example 2: API Health Gate

```yaml
tasks:
  call-api:
    purpose: Send a request to the target endpoint
    produces: { statusCode, responseTime }
    on-success: evaluate-response
    on-failure: none

  evaluate-response:
    purpose: Interpret the API response
    consumes: { statusCode, responseTime }
    # Internally: if statusCode >= 200 and < 300 then exit 0; else exit 1
    on-success: none (healthy)
    on-failure: none (unhealthy - no recovery defined)
```

---

## Example 3: Issue Processing with Recovery

```yaml
tasks:
  find-issue:
    purpose: Query for a work item labelled "ready"
    produces: { number, title, labels }
    on-success: claim-issue
    on-failure: none (no ready issues)

  claim-issue:
    purpose: Assign the issue to prevent duplicates
    consumes: { number }
    on-success: process-issue
    on-failure: none (already claimed)

  process-issue:
    purpose: Execute the work described by the issue
    consumes: { number, title, labels }
    produces: { resultSummary }
    on-success: verify-result
    on-failure: release-issue

  verify-result:
    purpose: Confirm the work matches the issue requirements
    consumes: { number, resultSummary }
    on-success: close-issue
    on-failure: release-issue

  close-issue:
    purpose: Mark the issue as resolved
    consumes: { number }
    on-success: none
    on-failure: none

  release-issue:
    purpose: Unassign the issue and report the failure
    consumes: { number }
    on-success: none
    on-failure: none
```

---

## Example 4: Multi-Step Build Pipeline

```yaml
task:
  name: build-and-test
  steps:
    - step-1-parallel-fetch:
        commands:
          - command: "fetch-dependency-a"
          - command: "fetch-dependency-b"
          - command: "fetch-dependency-c"
        # All three run in parallel.

    - step-2-build:
        commands:
          - command: "build-project"

    - step-3-test:
        commands:
          - command: "run-test-suite"

  on-success: none
  on-failure: none
```

Step 1 fetches three dependencies concurrently. Steps 2 and 3 are sequential. If step 1 fails, steps 2 and 3 are skipped.

---

## Example 5: Conditional Processing via Gate Task

```yaml
tasks:
  fetch-data:
    purpose: Retrieve data and emit its type
    produces: { dataType, dataContent }
    on-success: route-on-type
    on-failure: none

  route-on-type:
    purpose: Read dataType from context and exit accordingly
    consumes: { dataType }
    # Internally: if dataType == "urgent" then exit 0; else exit 1
    on-success: handle-urgent
    on-failure: handle-normal

  handle-urgent:
    purpose: Process the data with high priority
    consumes: { dataContent }
    on-success: none
    on-failure: none

  handle-normal:
    purpose: Process the data with standard priority
    consumes: { dataContent }
    on-success: none
    on-failure: none
```

---

## Example 6: Shared Finalization

```yaml
tasks:
  step-a:
    purpose: Perform the first operation
    produces: { stepAResult }
    on-success: step-b
    on-failure: cleanup

  step-b:
    purpose: Perform the second operation
    consumes: { stepAResult }
    produces: { stepBResult }
    on-success: step-c
    on-failure: cleanup

  step-c:
    purpose: Perform the final operation
    consumes: { stepBResult }
    on-success: cleanup
    on-failure: cleanup

  cleanup:
    purpose: Release resources and finalize
    on-success: none
    on-failure: none
```

`cleanup` is referenced by three predecessors. It handles both success-path finalization and failure recovery. It must not assume all context keys are present.

---

## Example 7: Idempotent Resource Creation

```yaml
tasks:
  check-resource:
    purpose: Determine whether the resource already exists
    produces: { resourceExists, resourceId }
    on-success: route-on-existence
    on-failure: none

  route-on-existence:
    purpose: Read resourceExists from context and exit accordingly
    consumes: { resourceExists }
    # Internally: if resourceExists == "true" then exit 1; else exit 0
    on-success: create-resource
    on-failure: use-existing-resource

  create-resource:
    purpose: Create the resource
    produces: { resourceId }
    on-success: use-resource
    on-failure: none

  use-existing-resource:
    purpose: Proceed with the existing resource
    consumes: { resourceId }
    on-success: use-resource
    on-failure: none

  use-resource:
    purpose: Perform the work that needs the resource
    consumes: { resourceId }
    on-success: none
    on-failure: none
```

The "already exists" path is not an error - it is a successful state.
