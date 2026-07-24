# Task Recipes — Executable Syntax Vocabulary

> **Interface-specific reference.** This file contains real executable syntax (gh, az, git, opencode, claude). It is the ONLY file in the skills with interface-specific content. Use these as vocabulary when composing tasks — do not copy them verbatim. Adapt the syntax to the user's tooling answers from the pre-design questionnaire.

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
sh -c 'issue=$(gh issue list --label "code:pick" --state open --limit 1000 --json number,title,body --jq ''sort_by(.number) | .[0] // empty | {number,title,body}''); test -n "$issue" && printf "%s\n" "$issue"'
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
opencode run "/plan-goal Implement this issue. Issue title: {{title}} Issue body: {{body}} Issue id: {{number}} Don't ask for confirmation, you are in auto mode. Plan, execute, and generate visual evidence."
```

- `{{title}}`, `{{body}}`, `{{number}}` are interpolated from context.
- Keep the prompt focused on the interpolated values, not vague search instructions.
- `/plan-goal` is prompt text. The executable remains `opencode`, with `run` as its first argument.
- No `--model` or `--agent` flags — those are runtime concerns, not task definition concerns.

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
git add .
```
```
sh -c 'if git diff --cached --quiet; then echo "No changes to commit"; else git commit -m "Resolve #{{number}}: {{title}}"; fi'
```
```
git push -u origin HEAD
```
```
gh issue edit {{number}} --remove-label "code:doing" --add-label "code:pr"
```
```
gh pr create --title "Resolve #{{number}}: {{title}}" --body "Closes #{{number}}" --base main
```

These are sequential **steps** within one finalization Task. Each step runs after the previous completes. The `sh -c` pattern guards against empty commits. The PR creation uses interpolated context from the selection Task.

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

These are sequential **steps** within one recovery Task. The label revert puts the item back in the selection queue for the next iteration. Recovery must be idempotent — if the local state is already clean, the reset is a no-op.

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
sh -c 'openspec list --json | jq -e ''(.changes | length) == 0'' >/dev/null'
```

Quick verification gate:

```
sh -c 'openspec list --json | jq -e ''(.changes | length) == 0'' >/dev/null && pnpm exec eslint --max-warnings 0 src/ tests/ && pnpm exec tsc --noEmit'
```

Full verification gate:

```
sh -c 'openspec list --json | jq -e ''(.changes | length) == 0'' >/dev/null && pnpm exec eslint --max-warnings 0 src/ tests/ && pnpm exec tsc --noEmit && pnpm run test && pnpm run build'
```

Do not compare serialized OpenSpec output to `[]`: `openspec list --json` returns `{ "changes": [] }`. Do not store the pipeline as raw `openspec` arguments. For Windows, use the equivalent PowerShell command.

## PR Closure

After a PR is created, merge it and close the work item.

### GitHub Issues

```
git push -u origin HEAD
```
```
gh issue edit {{number}} --remove-label "code:pr" --add-label "code:done"
```
```
gh pr merge --squash --delete-branch
```
```
gh issue close {{number}}
```
```
git checkout main
```

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

A shared terminal Task for the empty-work pattern. Silenced to avoid log noise.

```
echo "Nothing to do"
```

Set `silentChain: true` on this Task. Every selection Task's `onFailure` can point to the same silent terminator. Never use a silent task as `onSuccess` — it hides runs that did real work.

## Token Efficiency and Chain Composition

The token efficiency answer from the questionnaire determines how to compose the chain:

| Priority | Composition strategy |
|---|---|
| Critical | Every action is a separate concrete Task. The AI runner is used only for the smallest possible unit of judgment work. Selection, reservation, finalization, and recovery are all concrete CLI tasks. |
| Moderate | Concrete CLI tasks for selection, reservation, finalization, and recovery. One AI task for the main work. This is the canonical hybrid chain. |
| Low | One large AI task that handles searching, processing, and finalization. The AI runner receives the objective and manages everything internally. Least reliable, most token-intensive. |

The critical and moderate strategies use the scaffold pattern: concrete tasks bookend the AI work. The low strategy collapses everything into one AI invocation — simpler to design but harder to debug and recover from failure.
