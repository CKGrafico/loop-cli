---
name: loop-task-tasks
version: 1.1.0
description: >
  Design Loop Task Tasks: executable work units, success/failure chaining via
  onSuccess and onFailure, context production and consumption, stdout parsing,
  parameter interpolation, condition modelling, reuse, idempotency, and AI
  agent task patterns. Load when creating, reviewing, or modifying Tasks or
  reasoning about how a chain flows context between steps.
---

# Loop Task Tasks

A Task is one unit of executable work with a binary result: success or failure. Tasks exist independently from Loops — the same Task can be the initial Task of multiple Loops or the chain successor of multiple other Tasks.

## Pre-Design Questionnaire

Before composing concrete Task definitions, use the **question** tool to ask about any tooling the user has not already specified. Present missing questions together as one form. Never guess the issue tracker, CLI, AI runner, shell, or package manager.

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

Wait for all requested answers before proceeding. Answers determine executable syntax in Task payloads. A Task's `command` must be a real executable such as `gh`, `az`, `glab`, `opencode`, or `claude`. Slash commands such as `/plan-goal` belong inside an AI prompt passed as an argument to `opencode run` or `claude -p`. Model and agent flags remain runtime concerns.

For interface-specific syntax vocabulary to compose tasks from the questionnaire answers, see [references/recipes.md](references/recipes.md).

## What a Task Owns

| Property | Meaning |
|---|---|
| executable payload (command + commandArgs) | The work the Task performs |
| onSuccess | Next Task on success, or null |
| onFailure | Next Task on failure, or null |
| context | Initial key-value pairs seeded before this Task runs |
| silentChain | Hides the run from history when this task executes (use on onFailure only) |
| steps | Multi-step execution: steps sequential, commands within a step parallel |

For every property, see [references/domain-reference.md](references/domain-reference.md).

## Success and Failure

- Exit code 0 = success. Non-zero = failure.
- A process that cannot start or is killed = failure.
- stderr does not affect the result — only the exit code matters.

A Task's **domain outcome** must be translated into the exit code. When "no work found" should terminate the chain cleanly, the Task exits non-zero with no `onFailure` defined — the chain ends, the Loop waits for the next cadence.

## Chaining

The chain is a **linked list with two transitions** at each node. Each Task has at most one successor on success and one on failure.

| Result | onSuccess defined? | onFailure defined? | Outcome |
|---|---|---|---|
| Success | Yes | Any | Execute onSuccess |
| Success | No | Any | Chain terminates |
| Failure | Any | Yes | Execute onFailure |
| Failure | Any | No | Chain terminates |

Chain properties: sequential progression, no branching, no convergence, shared successors allowed (multiple Tasks can reference the same successor), no maximum depth, cycles possible but dangerous (Loop Task does not validate against them).

For truth tables, cycle analysis, and failure propagation, see [references/chaining.md](references/chaining.md).

## Context

A fresh iteration context is created before the first Task executes:

```
chainContext = { ...task.context, ...loop.context }
```

Loop context overrides Task context for same keys.

After each Task with chain successors (or multi-step/parallel commands), stdout is parsed and merged via `Object.assign`. Later keys overwrite earlier keys.

Before every Task executes, `{{key}}` placeholders in its payload are replaced with context values. Missing keys produce empty strings. Values are shell-escaped.

Context survives across success and failure transitions within the same iteration. Context is discarded after the iteration completes — never persisted, never shared between Loops.

For complete parsing rules, merge semantics, and edge cases, see [references/context.md](references/context.md).

## Conditions

Loop Task has no first-class Condition entity. Conditions are modelled through Task result semantics: the Task evaluates the condition, success selects `onSuccess`, failure selects `onFailure`.

The two-result-channel model cannot directly express tri-state conditions. Workaround: two successive Tasks (the first splits healthy/unhealthy, the second splits the remaining states) or a gate Task that reads context and exits accordingly.

For use-case tables, tri-state workarounds, and the empty-work pattern, see [references/conditions.md](references/conditions.md).

## Parallelism and Composition

Tasks within a chain execute **sequentially**. Each Task has at most one successor per result. Multiple Loops may run independently.

Loop Task does not provide native parallel branches, AND/OR joins, fan-out, or fan-in. Shell operators (`&&`, `||`) within a Task's payload are internal to that subprocess — Loop Task observes only the final exit code.

Commands within a single Task Step execute in parallel (`Promise.allSettled`), but this is an implementation detail of multi-step Tasks.

## AI Agent Tasks

An AI Task — one whose payload invokes an agent or language model — is expensive and stochastic. **Scaffold** it: concrete Tasks before it feed structured context via interpolation, concrete Tasks after it finalize or revert its output.

The canonical hybrid chain: selection (concrete) → reservation (concrete) → AI work → finalization (concrete) on success, recovery (concrete) on failure. The AI Task is the branch point.

Keep the AI payload focused on interpolated values (`{{number}}`, `{{title}}`, `{{body}}`) rather than vague natural-language search instructions.

For hybrid chain design, token efficiency, AI Task success criteria, and recovery patterns, see [references/ai-agent-patterns.md](references/ai-agent-patterns.md).

For interface-specific syntax vocabulary for composing concrete tasks, see [references/recipes.md](references/recipes.md).

## Idempotency

Because Loops repeat, Tasks must be safe to execute multiple times. Inspect before changing. Reserve before processing. Verify before finalizing. Handle "already done" gracefully. Separate selection from mutation.

## Verification Gates

Verification is a separate concrete Task after any AI or mutation Task. Never finalize work based only on an agent's exit code or self-reported summary.

Verification commands must validate structured output semantically. Never compare serialized JSON as a string. For example, `openspec list --json` returns an object such as `{ "changes": [] }`, not the array `[]`:

```sh
sh -c 'openspec list --json | jq -e ''(.changes | length) == 0'' >/dev/null && pnpm exec eslint --max-warnings 0 src/ tests/ && pnpm exec tsc --noEmit'
```

Use the repository's package manager and scripts when available. A pipeline is shell syntax, not a Loop Task argument list. On POSIX systems, set the Task command to `sh` and pass `-c` plus the complete script as arguments. On Windows, use an equivalent PowerShell command or a project-provided verification command. A verification command must exit non-zero for malformed output, unexpected schema, pending OpenSpec changes, lint errors, or type errors.

If verification or evidence capture needs temporary output, create a PID-scoped
directory under the current repository (for example `.loop-task-tmp/verify-$$`)
and ensure it is ignored. Do not use `/tmp` or another external directory;
remote runners can reject those paths or expose them through a different
permission boundary.

For the full verification contract and platform-safe alternatives, see [references/verification.md](references/verification.md).

## Reliable Task Workflow

Use this order for repository work:

```text
preflight → select → reserve → work → verify → finalize
```

Keep each boundary in a separate concrete Task when it can fail independently. Preflight checks the working tree, switches to the expected base branch, and fast-forward pulls it. Selection must produce a validated JSON object or exit non-zero for no work. Reservation runs only after selection succeeds. Work Tasks define a timeout and retry policy. Finalization runs only after verification succeeds.

Read [references/reliability.md](references/reliability.md) for environment, safety, timeout, retry, idempotency, output-contract, and confirmation rules.

## Antipatterns

- Enormous Tasks containing an entire workflow (prefer a chain of small Tasks).
- Unclear success criteria (a Task's purpose must map to an exit code).
- Relying on stderr to indicate failure (only exit code matters).
- Plain-text stdout when named values are needed later (use JSON keys).
- Overwriting context keys unintentionally (shallow merge, later wins).
- Self-referencing or cyclic Tasks (creates infinite execution within one iteration).
- Relying on context from a previous iteration (discarded each time).
- Using failure for all non-action outcomes ("no work" and "processing failed" are different).

## Cross-Skill References

- For cadence, iteration scheduling, and multi-loop pipelines, load **`loop-task-loops`**.
- For Project organisation, load **`loop-task-projects`**.
- For advanced chaining models, see [references/chaining.md](references/chaining.md).
- For the complete context lifecycle, see [references/context.md](references/context.md).
- For condition patterns, see [references/conditions.md](references/conditions.md).
- For AI agent task patterns, see [references/ai-agent-patterns.md](references/ai-agent-patterns.md).
