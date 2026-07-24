# Loop Domain Reference

Exhaustive reference for every meaningful Loop property.

## Core Properties

| Property | Meaning | Valid Values | Default | Lifecycle Impact | Edge Cases | Design Guidance |
|---|---|---|---|---|---|---|
| id | Unique identifier | 8-char hex string | Auto-generated | Immutable | Should not be reused after deletion | Treat as opaque |
| description | Human-readable statement of the recurring objective | Non-empty string | Required | Visible in listings and logs; no execution effect | Empty descriptions are rejected at creation | Write a clear one-sentence goal |
| intervalHuman | Human-readable cadence - the single source of truth for scheduling | Strings like "10s", "20m", "1h", "1d", "1w", or "0" for manual | Required in recipes | Parsed to milliseconds internally; "0" = manual-only | Use this instead of raw ms |
| taskId | References the initial Task for each iteration | Valid Task ID string, or null | null | When null, the Loop uses its inline command | If the referenced Task is deleted, the Loop fails at execution time | Prefer named Tasks over inline commands for reusability |
| command | Inline executable payload (used when taskId is null) | Non-empty string | "" (empty) | Executes as the initial work of each iteration | Ignored when taskId references a valid Task | Use for simple one-off Loops; prefer Tasks for chains |
| commandArgs | Arguments to the inline payload | Array of strings | [] | Passed alongside command | Ignored when taskId references a valid Task | Split payload into command + args for clarity |
| commandRaw | Original raw input string before parsing | String or undefined | undefined | Display only | May differ from command+commandArgs after quote parsing | Do not rely on this for execution logic |
| projectId | Which Project scopes this Loop | Valid Project ID string | "default" | Organisational only; no execution effect | If the Project is deleted, the Loop is reassigned to "default" | Assign to the Project matching the operational domain |
| immediate | Whether the first iteration runs without waiting | true or false | false | When true, first iteration starts immediately; when false, waits for phase delay | Ignored for manual Loops (intervalHuman="0") | Use true when the objective is urgent; false for scheduled alignment |
| maxRuns | Maximum number of iterations | Positive integer, or null | null (unlimited) | When reached, Loop enters paused state | Both failed and successful iterations count | Set a limit for bounded tasks; leave unlimited for ongoing objectives |
| cwd | Working directory for executable payloads | Absolute or relative path string | "" | Resolved against the Project's directory or process cwd | If the directory does not exist, the Task exits with code 1 | Set explicitly to avoid ambiguity |
| verbose | Whether detailed execution info is logged | true or false | false | Affects log output; no execution effect | None | Enable for debugging; disable in production |
| context | Initial key-value pairs seeded into every iteration | Flat object (string/number/boolean/null values) | undefined | Merged into the iteration context before the first Task executes | Loop context overrides Task context for the same key; nested objects and arrays are rejected by validation | Use for environment-specific values that never change across iterations |
| offset | Overrides the computed phase for spread scheduling | Integer (ms), or null | null | When null, phase is auto-computed from a hash of the Loop ID | Only affects the first-run delay alignment | Use null unless you need precise alignment with external schedules |

## Runtime State

| Property | Meaning | Values | Persistence |
|---|---|---|---|
| status | Current state of the Loop | running, waiting, paused, idle | Persisted |
| runCount | Number of completed iterations | Non-negative integer | Persisted |
| maxRunsReached | Whether the iteration limit has been hit | boolean | Persisted |
| sessionStartedAt | When the current execution session began | ISO 8601 string or null | Persisted, cleared on stop |
| lastRunAt | When the last iteration started | ISO 8601 string or null | Persisted |
| lastExitCode | Exit code of the last iteration's final Task | Integer or null | Persisted |
| lastDuration | Duration of the last iteration in ms | Integer or null | Persisted |
| nextRunAt | When the next iteration is scheduled | ISO 8601 string or null | Persisted, null when not scheduled |
| remainingDelayMs | Milliseconds remaining in the current delay | Integer or null | Persisted, preserved across pause/resume |
| runHistory | Recent iteration records (capped at 100) | Array of RunRecord | Persisted |
| skippedCount | Number of missed cadence points | Non-negative integer | Persisted |

## RunRecord Properties

| Property | Meaning |
|---|---|
| runNumber | Which iteration this record belongs to |
| startedAt | When the iteration (or chain step) started |
| exitCode | Process exit code |
| duration | Execution duration in ms |
| logSize | Bytes written to the log file |
| status | "running" or "completed" |
| logOffset | Byte offset into the log file |
| chainGroupId | Groups related chain steps within one iteration |
| chainName | Name of the chain Task (for chain steps only) |

## Constants and Limits

| Constant | Value | Meaning |
|---|---|---|
| MAX_CONTEXT_STDOUT_BYTES | 1,048,576 (1 MB) | Maximum stdout captured per Task for context parsing |
| MAX_LOG_BYTES | 1,048,576 (1 MB) | Log rotation threshold per file |
| MAX_LOG_GENERATIONS | 3 | Number of rotated log files retained |
| MAX_INMEMORY_RUN_HISTORY | 100 | Maximum run records kept in memory |
| SLEEP_CHUNK_MS | 200 | Granularity of the chunked sleep for responsive pause/trigger |
