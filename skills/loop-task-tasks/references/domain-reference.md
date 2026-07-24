# Task Domain Reference

Exhaustive reference for every meaningful Task property.

## Core Properties

| Property | Meaning | Valid Values | Default | Effect on Execution | Constraints | Reuse Implications |
|---|---|---|---|---|---|---|
| id | Unique identifier | 8-char hex string | Auto-generated | Immutable reference key | Should not be reused after deletion | Referenced by Loops and other Tasks |
| name | Human-readable label | Non-empty string | Derived from command | Display only; no execution effect | None | Use stable, descriptive names |
| command | The executable to run | Non-empty string | Required | Invoked as the primary payload | When `steps` is defined, `command` is used as the fallback for single-step Tasks | Same Task in different Loops runs the same payload |
| commandArgs | Arguments to the executable | Array of strings | [] | Passed alongside command | Each argument is interpolated separately | Context keys in args resolve per iteration |
| commandRaw | Original raw input before parsing | String or undefined | undefined | Display only | May differ from command+commandArgs | Do not rely on this for logic |
| onSuccessTaskId | Successor on success | Valid Task ID or null | null | When the Task succeeds and this is set, the referenced Task executes next | If the referenced Task does not exist, the chain terminates | Multiple Tasks can reference the same successor |
| onFailureTaskId | Successor on failure | Valid Task ID or null | null | When the Task fails and this is set, the referenced Task executes next | If the referenced Task does not exist, the chain terminates | Multiple Tasks can reference the same successor |
| context | Initial key-value pairs seeded into the iteration | Flat object (string/number/boolean/null values) | undefined | Merged into the iteration context before the Task executes; overridden by the Loop's context for overlapping keys | Nested objects and arrays are rejected by validation; values must be primitives | When reused, the same context seeds apply across all consumers |
| silentChain | Hide this run from the history panel | true or false | false | When any silent task executes during a chain, the entire run is hidden from the right panel run history | Never set a silent task as the `onSuccess` of a real-work task - it would hide runs that did meaningful work | Use for "no work found" terminators on `onFailure` only |
| steps | Multi-step execution definition | Array of TaskStep, or undefined | undefined | Steps run sequentially; commands within a step run in parallel | When absent, a single step is created from command+commandArgs | Advanced feature |
| createdAt | When the Task was created | ISO 8601 string | Auto-generated | Display only | Immutable | None |

## TaskStep Structure

A `TaskStep` contains an array of `TaskCommand` objects. Steps execute sequentially. Commands within a step execute **in parallel**.

```
TaskStep
  commands: TaskCommand[]

TaskCommand
  command: string        (interpolated)
  commandArgs: string[]  (each interpolated)
  commandRaw?: string
```

### When `steps` is absent

A single step is created from the Task's top-level `command` and `commandArgs`. This is the common case.

### When `steps` is defined

- Each step is an array of commands.
- Commands within a step run in parallel (`Promise.allSettled`).
- Steps run sequentially.
- If any command in a step fails, the step is considered failed and subsequent steps are skipped.
- Stdout from all commands in a step is concatenated (with newlines) and parsed together.

### When stdout is captured

Stdout is captured when **any** of these conditions is true:
- The Task has chain successors (`onSuccessTaskId` or `onFailureTaskId`)
- The Task has multiple steps
- The first step has multiple commands

When stdout is not captured, it is streamed directly to the log file without context parsing.

## Execution Cost Properties

| Property | Meaning |
|---|---|
| exitCode | Process exit code (0 = success, non-zero = failure) |
| duration | Wall-clock execution time in milliseconds |
| stdout | Captured standard output (if capture is enabled) |
| stderr | Not captured for context; written to log |

## Validation Rules

| Rule | Enforcement |
|---|---|
| `command` must not be empty when no `taskId` is provided on the Loop | Validated at Loop creation |
| `onSuccessTaskId` must reference an existing Task, or be null | Not validated - chain terminates if missing |
| `onFailureTaskId` must reference an existing Task, or be null | Not validated - chain terminates if missing |
| `context` values must be primitives (no nested objects or arrays) | Validated at creation |
| No cycle detection on chain references | Not validated - cycles cause infinite execution |
