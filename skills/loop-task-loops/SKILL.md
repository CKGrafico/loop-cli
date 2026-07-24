---
name: loop-task-loops
version: 1.1.0
description: >
  Design Loop Task Loops: cadence, iteration lifecycle, state transitions,
  non-overlapping execution, maximum iterations, and multi-loop pipeline
  coordination. Load when creating, reviewing, or modifying a recurring Loop
  or reasoning about how its chain behaves across iterations.
---

# Loop Task Loops

A Loop is a **cadence** — a recurring schedule that decides when an iteration starts. It decides _when_; its initial Task decides _what_. One Loop runs one iteration at a time, never overlapping.

## Pre-Design Questionnaire

Before designing a Loop, use the **question** tool to ask about any tooling the user has not already specified. Present missing questions together as one form. Never guess the issue tracker, CLI, AI runner, shell, or package manager.

```json
[
  {
    "question": "What issue/ticket system do you use?",
    "header": "Tracker",
    "options": [
      { "label": "GitHub Issues (gh)", "description": "Use gh CLI for issue and PR management." },
      { "label": "Azure DevOps (az)", "description": "Use az CLI for work-item and PR management." },
      { "label": "GitLab Issues (glab)", "description": "Use glab CLI for issue and merge request management." },
      { "label": "Jira (custom)", "description": "Use a custom script or API wrapper for Jira." },
      { "label": "Other", "description": "Specify the tool." }
    ]
  },
  {
    "question": "What AI runner do you use for AI Tasks?",
    "header": "AI Runner",
    "options": [
      { "label": "opencode run", "description": "Use opencode run for AI agent execution." },
      { "label": "claude -p", "description": "Use Claude CLI with -p for AI execution." },
      { "label": "aider", "description": "Use aider for AI-assisted coding." },
      { "label": "Other", "description": "Specify the runner." }
    ]
  },
  {
    "question": "What operating system, shell, and package manager will run these Tasks?",
    "header": "Runtime",
    "options": [
      { "label": "Windows + PowerShell", "description": "Prefer Node-based helpers and Windows-safe commands." },
      { "label": "macOS/Linux + POSIX shell", "description": "POSIX shell commands are available." },
      { "label": "Mixed environments", "description": "Use portable Node helpers where possible." },
      { "label": "Other", "description": "Specify the environment." }
    ]
  },
  {
    "question": "What label lifecycle do you use?",
    "header": "Labels",
    "options": [
      { "label": "pick to pr to done", "description": "Standard lifecycle with a PR stage." },
      { "label": "pick to done", "description": "Simple lifecycle without a PR stage." },
      { "label": "Custom", "description": "Specify the label transitions." }
    ]
  },
  {
    "question": "How important is consuming fewer tokens?",
    "header": "Tokens",
    "options": [
      { "label": "Critical", "description": "Break everything into small concrete CLI tasks. Minimise AI usage." },
      { "label": "Moderate", "description": "Mix concrete CLI tasks with AI tasks. Use AI for judgment work only." },
      { "label": "Low", "description": "One big AI task is acceptable. The AI can handle searching and processing." }
    ]
  }
]
```

Wait for all requested answers before proceeding. Answers determine executable syntax and chain composition. A Task's `command` must be a real executable such as `gh`, `az`, `glab`, `opencode`, or `claude`. Slash commands such as `/plan-goal` belong inside an AI prompt passed as an argument to `opencode run` or `claude -p`. Model and agent flags remain runtime concerns.

For interface-specific syntax vocabulary to compose concrete tasks from the questionnaire answers, see [references/recipes.md](references/recipes.md).

## What a Loop Owns

| Property | Meaning |
|---|---|
| cadence (intervalHuman) | How often iterations become eligible |
| initial Task (taskId) | First Task of each iteration, or null for inline payload |
| Project membership (projectId) | Which Project scopes this Loop |
| immediate | Whether the first iteration runs without waiting |
| maxRuns | Optional limit on total iterations |
| working directory (cwd) | Where executable payloads run |
| initial context | Key-value pairs seeded into every iteration |
| offset | Overrides the computed phase for spread scheduling |

For every property including runtime state, see [references/domain-reference.md](references/domain-reference.md).

## Cadence

Cadence is set via `intervalHuman` — a human-readable string like "10s", "20m", "1h", "1d". It is parsed to milliseconds internally. Use "0" for manual loops.

**First iteration**: `immediate = true` starts right away. `immediate = false` waits for a computed phase delay that distributes Loops across their cadence.

**Next iteration**: scheduled relative to the _start_ of the current iteration, not its end. If an iteration overruns the cadence, missed points are **skipped** (counted, not queued).

**Manual-only** (intervalHuman = "0"): the Loop never auto-schedules. Each iteration must be triggered explicitly. After each trigger, the Loop returns to idle.

See [references/lifecycle.md](references/lifecycle.md) for the full state-transition diagram and restoration semantics.

## Iteration Lifecycle

1. Loop becomes eligible (cadence point or manual trigger).
2. `runCount` increments by one. The full chain counts as one iteration.
3. Fresh context is created: seeded from `task.context` + `loop.context` (Loop overrides Task for same keys).
4. Initial Task (or inline payload) executes.
5. Chain continues sequentially via `onSuccess`/`onFailure`.
6. Context accumulates across the chain (stdout parsed and merged at each step).
7. Chain terminates when no successor matches the result.
8. Iteration recorded in run history.
9. `maxRuns` rechecked; next cadence point calculated.

## State Model

| State | Scheduling | Running Task |
|---|---|---|
| running | Inapplicable | Active |
| waiting | Counting down | None |
| paused | Suspended (preserves remaining delay) | None |
| idle | Cleared | None |

Key transitions: running → waiting (execution completes), running → paused (pause), waiting → running (delay or trigger), paused → waiting (resume, continues remaining delay), idle → waiting (play, fresh schedule), any active → idle (stop, clears schedule).

After reaching `maxRuns`, the Loop enters **paused**. There is no "completed" state — `maxRunsReached` distinguishes paused-by-limit from paused-by-user.

## Non-overlap

A Loop will not start another iteration while one is executing. Separate Loops run independently and concurrently. Tasks within one chain execute sequentially.

Non-overlap does not make side effects safe — two separate Loops modifying the same resource can still interfere. Design Tasks to be idempotent.

## Multi-Loop Pipelines

Loops can form a **pipeline** through shared external state markers (labels, tags). One Loop's finalization produces work the next Loop's selection consumes. Each Loop keeps its own cadence, chain, and context — they coordinate at the label boundary, never directly.

This is how production lines work: a refine Loop produces ready items, an implement Loop consumes them, both running at different cadences.

For label state machines, selection-reservation patterns, and state-aware recovery, see [references/playbooks.md](references/playbooks.md).

For interface-specific syntax vocabulary for composing concrete loops and multi-loop pipelines, see [references/recipes.md](references/recipes.md).

## Maximum Iterations

`maxRuns` is optional — null means unlimited. Each full iteration (including all chain Tasks) counts as one. Failed iterations count. After reaching `maxRuns`, the Loop pauses. Clearing the flag resets the count and allows play again.

## Dynamic Environment File

The daemon reads `~/.loop-cli/env` before spawning each child task. This file is a simple `KEY=VALUE` format, refreshed by an external script or a token-refresh Loop. Use this for short-lived credentials (e.g. GitHub App tokens) that expire faster than the daemon's lifetime.

```
GH_TOKEN=ghs_abc123...
API_KEY=xyz
```

Lines starting with `#` are ignored. Values may be quoted. The file is optional — if absent, child tasks use the daemon's environment as-is.

## Antipatterns

- Intervals shorter than normal execution time (guarantees skipped cadence points).
- Assuming missed intervals queue (they are skipped).
- Relying on overlapping execution within one Loop (never happens).
- Non-idempotent repeated effects (Tasks that create resources must handle "already exists").
- Using failure for ordinary no-work states (use success with no `onSuccess` — see `loop-task-tasks`).
- Assuming context persists between iterations (discarded each time).
- Accidental cycles in Task chains (Loop Task does not validate against them).
- One Loop for unrelated objectives (use separate Loops).

## Cross-Skill References

- For Task execution, chaining, context, conditions, and AI agent patterns, load **`loop-task-tasks`**.
- For Project organisation, load **`loop-task-projects`**.
- For cadence design examples, see [references/patterns.md](references/patterns.md) and [references/examples.md](references/examples.md).
