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

A Loop is a **cadence** - a recurring schedule that decides when an iteration starts. It decides _when_; its initial Task decides _what_. One Loop runs one iteration at a time, never overlapping.

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
    "question": "Which opencode agent should AI Tasks use? (If using opencode run, the agent must exist in .opencode/agents/ or the project's default_agent.)",
    "header": "Agent",
    "options": [
      { "label": "Project default", "description": "Use the default_agent from opencode.json (fullstack-engineer, backend-engineer, etc)." },
      { "label": "Specific agent", "description": "Specify the agent name (e.g. backend-engineer, frontend-engineer)." }
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

Wait for all requested answers before proceeding. Answers determine executable syntax and chain composition. A Task's `command` must be a real executable such as `gh`, `az`, `glab`, `opencode`, or `claude`. Slash commands such as `/plan-goal` belong inside an AI prompt passed as an argument to `opencode run` or `claude -p`. When using `opencode run`, always pass `--agent <name>` to select a project-defined agent with Abilities; without it, opencode falls back to the built-in `build` agent which has no project skills.

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

Cadence is set via `intervalHuman` - a human-readable string like "10s", "20m", "1h", "1d". It is parsed to milliseconds internally. Use "0" for manual loops.

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

After reaching `maxRuns`, the Loop enters **paused**. There is no "completed" state - `maxRunsReached` distinguishes paused-by-limit from paused-by-user.

## Non-overlap

A Loop will not start another iteration while one is executing. Separate Loops run independently and concurrently. Tasks within one chain execute sequentially.

Non-overlap does not make side effects safe - two separate Loops modifying the same resource can still interfere. Design Tasks to be idempotent.

## Multi-Loop Pipelines

Loops can form a **pipeline** through shared external state markers (labels, tags). One Loop's finalization produces work the next Loop's selection consumes. Each Loop keeps its own cadence, chain, and context - they coordinate at the label boundary, never directly.

This is how production lines work: a refine Loop produces ready items, an implement Loop consumes them, both running at different cadences.

For label state machines, selection-reservation patterns, and state-aware recovery, see [references/playbooks.md](references/playbooks.md).

For interface-specific syntax vocabulary for composing concrete loops and multi-loop pipelines, see [references/recipes.md](references/recipes.md).

## Maximum Iterations

`maxRuns` is optional - null means unlimited. Each full iteration (including all chain Tasks) counts as one. Failed iterations count. After reaching `maxRuns`, the Loop pauses. Clearing the flag resets the count and allows play again.

## Dynamic Environment File

The daemon reads `~/.loop-cli/env` before spawning each child task. This file is a simple `KEY=VALUE` format, refreshed by an external script or a token-refresh Loop. Use this for short-lived credentials (e.g. GitHub App tokens) that expire faster than the daemon's lifetime.

```
GH_TOKEN=ghs_abc123...
API_KEY=xyz
```

Lines starting with `#` are ignored. Values may be quoted. The file is optional - if absent, child tasks use the daemon's environment as-is.

## Writing a Recipe File

After composing a Loop and its Tasks, write them to disk as a recipe file so the daemon auto-discovers and schedules them. A recipe is a single `.yaml` file in `.loops/recipes/` relative to the project root.

### Recipe schema

```yaml
version: 2

loops:
  - taskId: <entry-task-id>
    intervalHuman: "10s"
    description: <human description>
    maxRuns: <number or null>
    immediate: <true or false>

tasks:
  - id: <unique-task-id>
    name: <display name>
    command: <executable>
    commandArgs: [<arg>, <arg>]
    onSuccessTaskId: <next-task-id or null>
    onFailureTaskId: <next-task-id or null>
    silentChain: <true or false>

diagram: |
  <ASCII art produced by loop-task-diagram skill>
```

### How to write a recipe

1. Compose the Loop cadence and Task chain using `loop-task-loops` and `loop-task-tasks`.
2. Write the `.yaml` file to `.loops/recipes/<name>.yaml` with `version`, `loops[]`, `tasks[]`. Leave `diagram:` empty or omit it for now.
3. Load **`loop-task-diagram`** to generate the ASCII art diagram and write it into the `diagram:` field. The diagram skill uses AST-preserving YAML writes so the data fields survive untouched.
4. Verify the daemon picks up the file: `loop-task status` should show the new recipe loop.

A recipe file with a `diagram` field looks like:

```yaml
version: 2

loops:
  - taskId: fetch-issues
    intervalHuman: 10s
    description: Fetch issue count on a cadence

tasks:
  - id: fetch-issues
    name: Fetch issues
    command: gh
    commandArgs: ["issue", "list", "--json", "number"]
    onSuccessTaskId: report
    onFailureTaskId: null

  - id: report
    name: Report count
    command: echo
    commandArgs: ["total issues: {{total}}"]
    onSuccessTaskId: null
    onFailureTaskId: null

diagram: |
  +------------+     +--------+
  | fetch-issues |---yes-->| report |--> ((end))
  +------------+     +--------+
```

## Antipatterns

- Intervals shorter than normal execution time (guarantees skipped cadence points).
- Assuming missed intervals queue (they are skipped).
- Relying on overlapping execution within one Loop (never happens).
- Non-idempotent repeated effects (Tasks that create resources must handle "already exists").
- Using failure for ordinary no-work states (use success with no `onSuccess` - see `loop-task-tasks`).
- Assuming context persists between iterations (discarded each time).
- Accidental cycles in Task chains (Loop Task does not validate against them).
- One Loop for unrelated objectives (use separate Loops).

## Cross-Skill References

- For Task execution, chaining, context, conditions, and AI agent patterns, load **`loop-task-tasks`**.
- For Project organisation, load **`loop-task-projects`**.
- For generating the ASCII art `diagram:` field in recipe files, load **`loop-task-diagram`** after writing the recipe.
- For cadence design examples, see [references/patterns.md](references/patterns.md) and [references/examples.md](references/examples.md).
