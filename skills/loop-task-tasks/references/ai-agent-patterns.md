# AI Agent Task Patterns

## The Scaffold

An AI Task - one whose executable payload invokes an agent or language model - is expensive, stochastic, and slow. The Tasks around it are cheap, deterministic, and fast. The **scaffold** is the frame of concrete Tasks that surrounds an AI Task: they feed it structured context, and they finalize or revert its output. The AI Task does the judgment work; the scaffold handles state.

A well-scaffolded AI Task never fetches its own inputs. A selection Task before it produces `{{number}}`, `{{title}}`, `{{body}}` via stdout. The AI Task interpolates those keys into its payload. The AI Task never manages external state - finalization Tasks after it handle labels, commits, pushes, PRs.

## Hybrid Chain Shape

The canonical hybrid chain has five positions, each a separate Task:

| Position | Type | Purpose | Produces |
|---|---|---|---|
| Selection | Concrete | Query for eligible work | `number`, `title`, `body` |
| Reservation | Concrete | Claim the work item (transition its state marker) | Nothing (or confirmation) |
| Work | AI | Perform the judgment-heavy task | Result summary (optional) |
| Verification | Concrete | Independently check the expected result | Nothing |
| Finalization | Concrete | Commit, label transition, PR creation | Nothing |
| Recovery | Concrete | Revert state, put item back in queue | Nothing |

Selection and reservation are often **steps** within one Task (step 1 queries, step 2 transitions the label). The AI Work Task is always its own Task - it is the branch point: success routes to finalization, failure routes to recovery.

## Why Separate Selection from Work

Feeding a vague natural-language instruction to an AI agent ("search for the next issue and implement it") costs tokens for the agent to search, costs latency for the search round-trip, and costs reliability - the agent may find the wrong item, format it differently, or miss it. A concrete selection Task costs milliseconds, produces structured JSON, and the AI Task receives it via interpolation.

The pattern:

```
Task 1 (concrete): query work items, output JSON → context {number, title, body}
Task 2 (AI):      "Implement issue {{number}}: {{title}}. Body: {{body}}"
Task 3 (concrete): commit, push, create PR
```

Each Task's stdout is parsed into context. The AI Task interpolates those keys. The concrete Tasks bookend the AI work.

## AI Task Success Criteria

An AI Task must translate its domain outcome into the process exit code:

- **Exit 0**: the agent completed its work successfully.
- **Exit non-zero**: the agent failed, produced invalid output, or encountered an unrecoverable error.

The agent's executable payload determines this. If the agent runs to completion but the result is wrong, the Task must still exit non-zero - the finalization chain must verify independently, not trust the agent's self-assessment. A verification Task after the AI Task (concrete, checking the result) catches silent failures.

## Context Passing to AI Tasks

The AI Task receives context through the same `{{key}}` interpolation as any Task. The selection Task's stdout (JSON) becomes context keys. The AI Task's payload references them.

Effective context keys for AI Tasks:

| Key | Source | Example use in AI payload |
|---|---|---|
| `number` | Selection Task stdout | Reference the work item |
| `title` | Selection Task stdout | Describe the objective |
| `body` | Selection Task stdout | Provide the full specification |
| `resultSummary` | Prior AI Task stdout | Chain AI Tasks sequentially |
| `output` | Auto-captured stdout+stderr of previous task | "Fix errors: {{output}}" |

Keep the AI payload focused on the interpolated values. The agent receives structured data, not a vague re-description of what to search for.

## Project commands and skills

When an AI runner works in a repository that provides project commands or
skills, invoke the command and let it load its own abilities and derive its own
checks. Do not duplicate a command's internal shell workflow in the prompt.

```yaml
command: opencode
commandArgs:
  - run
  - --agent
  - fullstack-engineer
  - /repo-audit
```

Use prompts only for task-specific context, such as `{{number}}`, `{{title}}`,
`{{body}}`, or `{{output}}`. Use a project command only when it is installed
for that runner. A Claude Task may invoke an available project command or skill
the same way; do not assume an OpenCode-only command exists in Claude.

Do not move deterministic shell verification into an AI Task merely because a
project command exists. Keep concrete verification, state changes, commits,
and pull-request actions in their own Tasks.

## AI Task Placement

Place the AI Task at the branch point of the chain. Everything before it is concrete (scaffold). Everything after it depends on its result:

```
Selection (concrete) → Reservation (concrete) → AI Work → Verification → Finalization (concrete)
                                                       ↘ failure       → Recovery (concrete)
```

The AI Task is the only Task that can fail unpredictably. The scaffold absorbs that failure: recovery reverts external state and returns the item to the queue.

Every AI Task also needs a timeout and retry policy. Retry transient runner or network failures only. Route invalid output, failed verification, and repository-state errors to recovery without retrying blindly.

## PR CI repair loop

Creating a pull request is not finalization. Required remote checks run after
the branch is pushed, so the chain needs a second verification gate before any
merge or issue closure:

```
create PR (concrete) → wait for required checks (concrete) → merge policy (concrete)
                              └── failed checks → diagnose and repair (AI)
                                                     → commit and push (concrete)
                                                     → comment on PR (concrete)
                                                     → wait for required checks
```

The check Task is the branch point. It waits for required checks and exits
zero only when they pass. A failed check routes to an AI Task that diagnoses
the logs and fixes repository-owned defects. The repair path returns to the
same check Task after a verified push.

Bound this cycle with `maxRuns` on the check Task. When the limit is reached,
or when the failure is external or unsafe to fix, leave the PR open, mark the
work item for human review, and clean the local worktree. Do not merge a PR
with failing or unknown checks.

Keep the AI repair prompt narrow: inspect failed checks and logs, fix only
actionable defects, run repository checks, and never weaken CI, coverage,
security, lint, test, or build gates. The concrete tasks own pushing,
commenting, merge policy, labels, and issue closure.

After each successful repair push, add one concise PR comment with the failed
checks, the repair summary, and local verification. Include a commit SHA or
another stable repair identifier so retries can detect and avoid duplicate
comments.

## Recovery for AI Tasks

AI Tasks fail more often than concrete Tasks - the agent may produce broken code, misunderstand the objective, or time out. Recovery must be **state-aware**: revert the external markers the reservation Task set, undo local changes, and return the work item to its pre-reservation state.

Recovery sequence:

1. Undo local changes (working directory reset, untracked file removal).
2. Revert the reservation's state marker (label transition back to the selection state).
3. Return to a clean baseline (sync with the default branch).

After recovery, the item is eligible for the next iteration's selection Task. The Loop continues to the next cadence.

Recovery must be idempotent. Releasing an already released item, restoring an already clean worktree, or repeating an already completed local cleanup should succeed without creating a second side effect.

## When to Use an AI Task vs a Concrete Command

| Work type | Use |
|---|---|
| Querying, filtering, sorting items | Concrete |
| State transitions (labels, statuses) | Concrete |
| File operations (add, commit, push) | Concrete |
| Creating PRs, issues, comments | Concrete |
| Writing code from a specification | AI |
| Refining or rewriting text | AI |
| Auditing, reviewing, scoring | AI |
| Designing a solution from requirements | AI |

The test: if the work is deterministic and has a direct executable, use a concrete Task. If the work requires judgment, language understanding, or creative output, use an AI Task. When using an AI Task, scaffold it - selection before, finalization after, recovery on failure.

## Multi-Step AI Chains

When multiple AI Tasks chain sequentially, each produces context for the next. The first AI Task refines the input; the second consumes the refined input and produces the final output. Keep the chain short - each AI Task adds latency and failure surface.

```
AI Task 1: "Refine issue {{number}}: {{title}}. Body: {{body}}"
  → produces {refinedTitle, refinedBody}

AI Task 2: "Implement {{refinedTitle}}. Specification: {{refinedBody}}"
  → produces {resultSummary}
```

Context accumulates across the chain. Later AI Tasks see all earlier context keys. Use named JSON keys (not the `output` key) for values that must survive across AI Tasks.

## OpenCode Serve Model

When the daemon starts, it manages a persistent `opencode serve` sidecar process. Recipe tasks that invoke `opencode run` automatically connect to this warm serve instance via `--attach`, eliminating per-task cold-start time.

### What gets auto-injected (no recipe changes needed)

When loop-task detects an `opencode run` command, it automatically injects:

- `--format json` into args (for structured output parsing)
- `--attach http://localhost:4096` when serve is alive (warm start)
- `--dir <cwd>` so serve operates in the correct working directory
- `--session <id>` when a prior opencode task in the same chain produced a session ID
- `--model <model>` when chaining sessions and the prior task specified a model

Static OTEL config lives in the serve process env (set once at daemon boot). Per-task only `TRACEPARENT` and `TRACESTATE` are injected.

### context.opencode.* keys

After an `opencode run` task completes, loop-task parses the JSONL stdout stream and makes structured data available in context:

| Key | Example | Description |
|-----|---------|-------------|
| `{{opencode.session.id}}` | `ses_abc123` | Session ID (auto-chained to next opencode task) |
| `{{opencode.tokens.input}}` | `671` | Input tokens (accumulated across same-session tasks) |
| `{{opencode.tokens.output}}` | `8` | Output tokens (accumulated) |
| `{{opencode.tokens}}` | indented JSON | Full token object with cache breakdown |
| `{{opencode.cost}}` | `0.042` | Total cost in USD (accumulated) |
| `{{opencode.tools.count}}` | `3` | Number of tool calls |
| `{{opencode.tools.names}}` | `["bash","read"]` | Unique tool names used |
| `{{opencode.gitSnapshot}}` | `09dd05d...` | Git snapshot hash from final step |
| `{{opencode.error}}` | indented JSON | Error info if an error occurred |
| `{{opencode.text}}` | truncated text | Last text before final step_finish (agent summary) |
| `{{opencode.model}}` | `plainconcepts/glm-5-1` | Model used (auto-carried to chained tasks) |

When a context value is an object, `{{opencode.tokens}}` renders as indented JSON via `JSON.stringify(value, null, 2)`.

### Auto session chaining

When a chain has multiple `opencode run` tasks, loop-task automatically injects `--session` and `--model` from the prior opencode task. The agent remembers the conversation context:

```yaml
- id: implement
  command: opencode
  commandArgs: [run, --agent, fullstack, --model, plainconcepts/glm-5-1, "implement #158"]
  # After: context.opencode.session.id = ses_abc, context.opencode.model = plainconcepts/glm-5-1

- id: fix-tests
  command: opencode
  commandArgs: [run, --agent, fullstack, "fix the tests"]
  # Auto-injected: --session ses_abc --model plainconcepts/glm-5-1
  # Agent remembers implementation from Task 1
  # Tokens and cost accumulate across both tasks

- id: pr
  command: sh
  commandArgs: [-c, 'gh pr create --title "Resolve #{{number}}" --body "Tokens: {{opencode.tokens}} Cost: ${{opencode.cost}}"']
  # Shows total session usage across all opencode tasks
```

Session chaining is within the same loop chain only. Context is discarded between iterations.

### Token accumulation

When multiple opencode tasks share the same session, tokens and cost accumulate:
- Task 1: input=100, cost=0.02
- Task 2: input=80, cost=0.01
- `{{opencode.tokens.input}}` after Task 2 = 180
- `{{opencode.cost}}` after Task 2 = 0.03

### Fallback behavior

If the serve process is not running (crash, port in use, opencode not installed), loop-task falls back to cold-start `opencode run` without `--attach`. Fully functional, just slower.

### Claude Code

Claude Code does not support the serve model (`claude -p` has no `--attach` equivalent). Claude Code tasks continue to use per-task env injection.
