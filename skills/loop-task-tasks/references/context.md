# Context Lifecycle Reference

## Overview

The iteration context is a key-value map (`Record<string, unknown>`) that carries data between Tasks within a single iteration. Created fresh each iteration, extended by Task stdout, discarded when the iteration completes.

## 1. Creation

A new, empty context is created at the start of each iteration, before the first Task executes.

## 2. Initial Seeding

```
chainContext = { ...task.context, ...loop.context }
```

Loop context overrides Task context for the same key. Shallow merge via spread operator. When neither provides context, starts empty (`{}`).

### Validation

Initial context values must be primitives: strings, numbers, booleans, or null. Nested objects and arrays are rejected by the validation function at creation time.

## 3. Stdout Capture

Stdout is captured only when at least one of these conditions is true:
- The Task has chain successors (`onSuccessTaskId` or `onFailureTaskId` is defined)
- The Task has multiple steps
- The first step has multiple commands

When stdout is **not** captured, it is streamed directly to the log file. No context parsing occurs.

### Capture mechanism

- Captured via a transform stream that accumulates bytes.
- Capped at **1 MB** (`MAX_CONTEXT_STDOUT_BYTES = 1048576`).
- If exceeded, truncated. A warning is written to the log, but the captured portion is still parsed.
- Stderr is **never** captured for context. Written to the log file only.

## 4. Parsing Rules

### Step 1: Trim

Leading/trailing whitespace removed.

### Step 2: Empty check

If trimmed output is empty, no context change occurs. Parser returns `null`.

### Step 3: Whole-output JSON parse attempt

If `JSON.parse` succeeds:

| Parsed result | Context update |
|---|---|
| JSON object | Keys merged directly into the context |
| JSON string primitive | `{ output: String(value) }` |
| JSON number primitive | `{ output: "42" }` (converted to string) |
| JSON boolean primitive | `{ output: "true" }` (converted to string) |
| JSON null | `{ output: "null" }` |
| JSON array | `{ output: originalString }` (stored as raw string) |

### Step 4: JSONL parse attempt (when whole-output parse fails)

Output split into lines. Each non-empty line parsed as JSON:

- If ALL non-empty lines parse successfully:
  - Object line keys merged into context.
  - Primitive line stored under `output` key.
  - Example: `{"a":1}\n{"b":2}` → `{ a: 1, b: 2 }`

- If ANY line fails: fall through to plain text.

### Step 5: Plain text fallback

Any output that is not valid JSON or JSONL is stored under the `output` key:

- `{ output: trimmedString }`
- Multi-line plain text preserves internal newlines.

## 5. Merge Semantics

Parsed output is merged via `Object.assign(chainContext, parsed)`.

| Merge rule | Behaviour |
|---|---|
| New key | Added to the context |
| Existing key | Overwritten (shallow replacement) |
| The `output` key | Overwritten every time a Task produces plain-text output |
| Structured keys (from JSON) | Each key added or overwritten individually |
| No deep merge | Nested objects replaced at the top level |

### Key clobbering

A Task producing plain text **always** overwrites the `output` key. To preserve values across chain steps, use **named JSON keys**.

In JSONL output, later lines overwrite earlier lines for the same key.

## 6. Stderr in context

When stdout is valid JSON (an object), its keys are merged as described in section 5. Stderr is ignored for context in this case and kept in logs only.

When stdout is non-JSON or empty, stderr is combined with stdout and the combined text is parsed together. `{{output}}` then includes error messages, compiler output, test failures, and other diagnostic text the Task wrote to stderr.

AI fix tasks that read `{{output}}` automatically see what went wrong. No custom JSON wrapper is needed to surface error text into context.

## 7. Interpolation

`{{key}}` placeholders in command and arguments are replaced with context values before every Task executes.

### Syntax

`{{key}}` where `key` matches `\w+` (one or more word characters).

### Behaviour

| Context state | Result |
|---|---|
| String value | Shell-escaped and inserted |
| Number value | `String(value)`, shell-escaped |
| Boolean value | `"true"` or `"false"` inserted |
| Null | Empty string |
| Key does not exist | Empty string (no error) |

### Shell escaping

- Safe characters (letters, digits, `_-=:./,@`) pass through unmodified.
- Everything else wrapped in single quotes with internal single quotes escaped.

### What interpolation does not do

- Does not modify the context (original values remain).
- Does not support nested `{{outer.{inner}}}` syntax.
- Does not support default values or conditional expressions.

## 8. Context Lifetime

| Boundary | Behaviour |
|---|---|
| Between Tasks in the same chain | Context persists and accumulates |
| Across success/failure transitions | Context persists |
| Between iterations | Context is **discarded** |
| Between Loops | Context is **not shared** |
| On persistence | Context is **never persisted** |

## 9. Edge Cases

| Edge case | Behaviour |
|---|---|
| Task produces no output | No context change |
| Task produces only whitespace | No context change |
| Invalid JSON that looks like JSONL | JSONL detection fails → plain text under `output` |
| Two Tasks produce the same named key | Later value overwrites earlier |
| Task produces a JSON array | Stored as raw string under `output` |
| Task produces a JSON primitive | Converted to string under `output` |
| Context value contains special characters | Shell-escaped during interpolation |
| Context value contains newlines | Preserved in context; shell-escaped during interpolation |
| Context key contains non-word characters | Not matchable by `{{key}}` |
| Task with no successors produces stdout | Not captured; goes to log only |
| Multi-step: JSON then plain text | JSON keys merged, then `output` overwritten |
