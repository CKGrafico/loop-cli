# Task Recipes - Executable Syntax Vocabulary

> **Interface-specific reference.** This file contains real executable syntax (gh, az, git, opencode, claude). It is the ONLY file in the skills with interface-specific content. Use these as vocabulary when composing tasks - do not copy them verbatim. Adapt the syntax to the user's tooling answers from the pre-design questionnaire.

This file provides syntax patterns for each position in the hybrid chain. The agent reads these to learn the executable vocabulary, then composes a unique task set based on the questionnaire answers.

## Preflight

Run repository preflight before selecting work:

```
git status --porcelain && git switch main && git fetch origin && git rebase origin/main
```

Keep this separate from selection. A dirty worktree, missing `main` branch, or diverged history stops the chain before any issue is reserved.

## Selection

Query for eligible work items. Output must be JSON so Loop Task can parse it into context.

### GitHub Issues

```
sh -c 'number=$(gh issue list --label "code:pick" --state open --limit 1000 --json number --jq ''sort_by(.number) | .[0].number''); test -n "$number" || exit 75; body=$(gh issue view "$number" --json number,title,body --jq ''{number,title,body}''); gh issue edit "$number" --add-label code:doing --remove-label code:pick >/dev/null; printf "%s\n" "$body"'
```

- `--state open` excludes closed work.
- `--limit 1000` bounds the query before local sorting.
- `sort_by(.number) | .[0]` selects the lowest issue number from the returned candidates.
- `--json number,title,body` selects fields for context parsing.
- The shell guard rejects an empty selection instead of passing an empty `{{number}}` to reservation. For non-POSIX environments, use the equivalent native shell guard.
- When no issues match, the selection Task exits non-zero without calling reservation.
- When an issue matches, stdout is `{"number":42,"title":"...","body":"..."}` → parsed into context.

### Azure DevOps

```
az boards query --wiql "SELECT [System.Id],[System.Title],[System.Description] FROM WorkItems WHERE [System.Tags] CONTAINS 'code:pick' ORDER BY [System.Id] ASC" --output json --query "[0].{number:id,title:fields.[System.Title],body:fields.[System.Description]}"
```

- `--query` uses JMESPath to shape output like `--jq` does for `gh`.
- When no items match, output is `null` or empty → the Task should exit non-zero.

## Reservation

Transition the work item's state marker to claim it.

### GitHub Issues

```
gh issue edit {{number}} --add-label "code:doing" --remove-label "code:pick"
```

- `{{number}}` is interpolated from the selection Task's context output.
- Label transition prevents duplicate selection by other Loops.

### Azure DevOps

```
az boards work-item update {{number}} --fields "System.Tags=code:doing" --output json
```

- Updates the tags field on the work item.

## AI Work

Invoke an AI runner with interpolated context. The AI performs judgment-heavy work.

### opencode run

```
opencode run --agent {{agentName}} "First, load all skills available for your current agent. Then /plan-goal Implement this issue. Issue title: {{title}} Issue body: {{body}} Issue id: {{number}} Don't ask for confirmation, you are in auto mode. Plan, execute, and generate visual evidence."
```

- `--agent {{agentName}}` is required. Without it, `opencode run` falls back to the built-in `build` agent which has no project Abilities and cannot discover project skills. Use the Agent answer from the questionnaire. If "Project default", read `default_agent` from `opencode.json` and use that value.
- `{{title}}`, `{{body}}`, `{{number}}` are interpolated from context.
- Keep the prompt focused on the interpolated values, not vague search instructions.
- `/plan-goal` is prompt text. The executable remains `opencode`, with `run` as its first argument.
- No `--model` flag, that is a runtime concern, not a task definition concern.

### claude -p

```
claude -p "Implement this issue. Issue title: {{title}} Issue body: {{body}} Issue id: {{number}} Don't ask for confirmation, you are in auto mode."
```

- Same interpolation pattern. `claude -p` reads the prompt and exits with code 0 on success.

### aider

```
aider --message "Implement issue {{number}}: {{title}}. {{body}}" --yes-always
```

- `--yes-always` prevents interactive prompts (the Task must not block on input).
- Aider exits non-zero if it cannot complete the changes.

## Finalization

Commit, push, and transition the work item to the next state.

### GitHub Issues

```
git add -A
```
```
git commit -m "Resolve #{{number}}: {{title}}" || true
```
```
git push -u origin HEAD
```
```
sh -c 'isBug=$(gh issue view {{number}} --json labels --jq "[.labels[].name] | index(\"bug\") != null"); prUrl=$(gh pr create --title "Resolve #{{number}}: {{title}}" --body "Closes #{{number}}" --label code:review --base main); printf "{\"prUrl\":\"%s\",\"isBug\":%s}\n" "$prUrl" "$isBug"'
```

These steps create the PR and expose its URL to later Tasks. Do not merge or
close the issue here. `isBug` is one example of a merge-policy flag; define it
from the work item's labels or your equivalent trusted state. Remote CI has not
yet verified the pushed commit.

## PR CI gate

After PR creation, use a concrete check Task before merge policy or issue
closure:

```
gh pr checks "{{prUrl}}" --required --watch --fail-fast
```

- `--watch` waits for checks to finish; use a timeout longer than the slowest
  required workflow.
- Exit zero routes to the merge-policy Task. A non-zero exit routes to the
  repair Task. The repair task must inspect `gh pr checks` and `gh run view`
  logs rather than guessing from the check name alone.
- Make the check Task the target of the repair back-edge and set a small,
  explicit `maxRuns` limit. When repairs are exhausted or a failure is not
  repository-owned, leave the PR open and transition the issue to review.

The repair path is:

```
AI diagnose and fix → local verification → commit and push → PR comment → required-check gate
```

The PR comment should name failed checks, summarize the repair, and list local
verification. Use the pushed commit SHA in the comment or lookup so a retry
does not create duplicates.

## Merge policy and PR closure

Merge only after the required-check gate succeeds. A policy may keep ordinary
PRs open for review while merging a narrowly defined class, such as trusted
bug fixes, automatically:

```
sh -c 'if [ "{{isBug}}" = "true" ]; then gh pr merge "{{prUrl}}" --squash --delete-branch; fi'
```

Do not use an administrator merge option to bypass a failing or pending check.
If repository policy explicitly requires that option, invoke it only after the
green gate. Close the issue only when its PR was merged; otherwise label it as
ready for review and leave it open.

```
gh issue edit {{number}} --add-label code:done --remove-label code:doing --remove-label code:review
```
```
gh issue close {{number}}
```
```
git checkout -- . && git clean -fd && git switch main
```

### Azure DevOps

```
git add .
```
```
sh -c 'if git diff --cached --quiet; then echo "No changes"; else git commit -m "Resolve #{{number}}: {{title}}"; fi'
```
```
git push -u origin HEAD
```
```
az boards work-item update {{number}} --fields "System.Tags=code:pr" --output json
```
```
az repos pr create --title "Resolve #{{number}}: {{title}}" --work-items {{number}} --output json
```

## Recovery

Undo local changes and revert the work item's state marker so it becomes eligible again.

### GitHub Issues

```
git reset --hard
```
```
git clean -fd
```
```
git switch main
```
```
git fetch origin && git rebase origin/main
```
```
gh issue edit {{number}} --remove-label "code:doing" --add-label "code:pick"
```

These are sequential **steps** within one recovery Task. The label revert puts the item back in the selection queue for the next iteration. Recovery must be idempotent - if the local state is already clean, the reset is a no-op.

### Azure DevOps

```
git reset --hard
```
```
git clean -fd
```
```
git switch main
```
```
git fetch origin && git rebase origin/main
```
```
az boards work-item update {{number}} --fields "System.Tags=code:pick" --output json
```

## Verification

Verification is its own concrete Task between AI work and finalization. It must independently check repository state and exit non-zero when checks fail.

For this repository, run the OpenSpec predicate inside an explicit shell Task:

```
sh -c 'openspec list --json | python3 -c ''import sys,json; exit(0 if len(json.load(sys.stdin).get("changes",[]))==0 else 1)'''
```

Quick verification gate:

```
sh -c 'openspec list --json | python3 -c ''import sys,json; exit(0 if len(json.load(sys.stdin).get("changes",[]))==0 else 1)'' && pnpm exec eslint --max-warnings 0 src/ tests/ && pnpm exec tsc --noEmit'
```

Full verification gate:

```
sh -c 'openspec list --json | python3 -c ''import sys,json; exit(0 if len(json.load(sys.stdin).get("changes",[]))==0 else 1)'' && pnpm exec eslint --max-warnings 0 src/ tests/ && pnpm exec tsc --noEmit && pnpm run test && pnpm run build'
```

Do not compare serialized OpenSpec output to `[]`: `openspec list --json` returns `{ "changes": [] }`. Do not store the pipeline as raw `openspec` arguments. For Windows, use the equivalent PowerShell command.

## PR Closure

For GitHub, use the required-check gate and merge policy above. Never merge a
newly created PR directly from this section.

### Azure DevOps

```
git push -u origin HEAD
```
```
az boards work-item update {{number}} --fields "System.Tags=code:done" --output json
```
```
az repos pr update --id {{prId}} --status completed --output json
```
```
git checkout main
```

## Silent Terminator

A shared terminal Task for the empty-work pattern. Hides the run from history when no work is found.

```
echo "Nothing to do"
```

Set `silentChain: true` on this Task. Every selection Task's `onFailure` can point to the same silent terminator. Never use a silent task as `onSuccess` - it hides runs that did real work.

## Cleanup for non-committing tasks

Tasks that invoke AI agents (like refinement loops) may create `.tmp` folders or other artifacts without committing. These leave the working tree dirty, causing the next iteration's preflight to fail. Always add cleanup to verify or finalize tasks after AI work:

```
git checkout -- .
git clean -fd
```

This reverts tracked changes and removes untracked files. Never use `git clean -fdx` - the `-x` flag removes ignored files like `node_modules`.

## Sub-Issue Linking for Report Tasks

When an AI Task creates a parent report issue (e.g. an audit report) and several child issues from its findings, link the children as sub-issues of the parent. This lets a cleanup loop check `sub_issues_summary` to know when all children are resolved.

### Creating the parent

```
gh issue create --title "Audit Report: ..." --label "audit:report"
```

Capture the parent issue number from the URL output. Pass it to the next Task via context.

### Linking children as sub-issues

After each child issue is created, link it to the parent via the GitHub API:

```
curl -s -X POST "https://api.github.com/repos/$(gh repo view --json nameWithOwner --jq .nameWithOwner)/issues/$PARENT_NUMBER/sub_issues" -H "Authorization: token $GH_TOKEN" -H "Accept: application/vnd.github+json" -d '{"sub_issue_id": CHILD_NUMBER}'
```

The `$GH_TOKEN` comes from the daemon's env file. Sub-issue linking requires Issues: write permission on the GitHub App.

### Reading sub-issue status in a cleanup loop

```
curl -s "https://api.github.com/repos/$REPO/issues/$NUMBER" -H "Authorization: token $GH_TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); s=d.get('sub_issues_summary',{}); exit(0 if s.get('completed',0)==s.get('total',0) and s.get('total',0)>0 else 1)"
```

When `completed` equals `total` and `total` is greater than zero, all children are closed and the parent report can be closed. Use this in a daily cleanup loop alongside the audit loop.

## Token Efficiency and Chain Composition

The token efficiency answer from the questionnaire determines how to compose the chain:

| Priority | Composition strategy |
|---|---|
| Critical | Every action is a separate concrete Task. The AI runner is used only for the smallest possible unit of judgment work. Selection, reservation, finalization, and recovery are all concrete CLI tasks. |
| Moderate | Concrete CLI tasks for selection, reservation, finalization, and recovery. One AI task for the main work. This is the canonical hybrid chain. |
| Low | One large AI task that handles searching, processing, and finalization. The AI runner receives the objective and manages everything internally. Least reliable, most token-intensive. |

The critical and moderate strategies use the scaffold pattern: concrete tasks bookend the AI work. The low strategy collapses everything into one AI invocation - simpler to design but harder to debug and recover from failure.

## OpenCode Serve Integration Patterns

When opencode serve is running (managed by the daemon), `opencode run` tasks automatically get `--attach`, `--format json`, `--session`, and `--model` injected. `context.opencode.*` keys are available in subsequent tasks.

### Pattern 1: Auto session chaining (implement → fix-tests → PR)

```yaml
- id: implement
  command: opencode
  commandArgs: [run, --agent, fullstack, --model, plainconcepts/glm-5-1, "implement #{{number}}: {{title}}. {{body}}"]
  # Auto-injected: --format json --attach http://localhost:4096 --dir <cwd>
  # After: context.opencode.session.id, context.opencode.model available
  onSuccessTaskId: fix-tests

- id: fix-tests
  command: opencode
  commandArgs: [run, --agent, fullstack, "fix the failing tests"]
  # Auto-injected: --session <id> --model plainconcepts/glm-5-1
  # Agent remembers implementation from Task 1, uses same model
  # Tokens and cost accumulate across both tasks
  onSuccessTaskId: pr

- id: pr
  command: sh
  commandArgs:
    - -c
    - 'gh pr create --title "Resolve #{{number}}: {{title}}" --body "Closes #{{number}}. Tokens: {{opencode.tokens}} Cost: ${{opencode.cost}}"'
```
```

### Pattern 2: Token and cost reporting in PR comments

```yaml
- id: implement
  command: opencode
  commandArgs: [run, --agent, fullstack, "implement #{{number}}"]
  onSuccessTaskId: pr

- id: pr
  command: sh
  commandArgs:
    - -c
    - >
      gh pr create --title "Resolve #{{number}}: {{title}}"
      --body "Closes #{{number}}

      Token usage:
      {{opencode.tokens}}

      Cost: ${{opencode.cost}}
      Tools used: {{opencode.tools.count}} ({{opencode.tools.names}})"
```

### Pattern 3: Error-aware routing

```yaml
- id: implement
  command: opencode
  commandArgs: [run, --agent, fullstack, "implement #{{number}}"]
  onSuccessTaskId: check-error
  onFailureTaskId: recover

- id: check-error
  command: sh
  commandArgs:
    - -c
    - 'test -z "{{opencode.error}}" && exit 0 || exit 1'
  onSuccessTaskId: pr
  onFailureTaskId: log-error

- id: log-error
  command: sh
  commandArgs:
    - -c
    - 'echo "OpenCode error: {{opencode.error}}" && gh issue comment {{number}} --body "Agent error: {{opencode.error}}"'
  onSuccessTaskId: recover

- id: recover
  command: sh
  commandArgs: [-c, 'git reset --hard && git clean -fd && git switch main && gh issue edit {{number}} --add-label code:review --remove-label code:doing']
  onSuccessTaskId: null
  onFailureTaskId: null
```
