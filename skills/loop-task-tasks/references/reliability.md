# Reliable Task Design

Use this reference when a Task touches a repository, external service, or persistent work item.

## Environment

Collect operating system, shell, package manager, issue tracker CLI, and AI runner before composing commands when the user has not supplied them. A Loop Task passes command arguments directly, so shell syntax belongs inside an explicit shell command such as `sh -c`. Declare optional tools such as `jq` instead of making them implicit.

Keep executables separate from prompts. `opencode run "/plan-goal ..."` is valid. `/plan-goal` alone is not an executable. The same rule applies to other slash commands and CLI prompt modes.

## Repository preflight

Run preflight before selection or mutation:

```sh
git status --porcelain && git switch main && git fetch origin && git rebase origin/main
```

The clean check prevents an automated Task from overwriting local work. Fetch + rebase prevents an unattended merge. If either check fails, stop and report the exact next action.

## Post-task cleanup

AI agent and refinement Tasks may create temporary files, `.tmp` folders, or other artifacts. These leave the working tree dirty, which causes the next iteration's preflight to fail. Always clean up after tasks that are not meant to commit or push:

```sh
git checkout -- . && git clean -fd
```

Add this to verify or finalize tasks that follow AI work. `git checkout -- .` reverts tracked file changes, `git clean -fd` removes untracked files and directories. Never use `git clean -fdx` (the `-x` flag removes ignored files like `node_modules`).

## Timeouts and retries

Every network, AI, build, and test Task defines:

- maximum runtime;
- retry count;
- retry delay;
- retryable failures;
- recovery path after the final failure.

Retry transient transport failures. Do not retry invalid configuration, failed verification, dirty repository state, or malformed output without changing the cause.

## Idempotency

Separate inspect, reserve, mutate, verify, and finalize. Each mutation handles an already-completed state safely. A repeated reservation must not create duplicate labels. A repeated finalization must not create duplicate commits, pushes, pull requests, comments, or closures.

## Output contracts

Every context-producing Task names its output schema and required keys. Validate the schema before interpolation. Empty output, malformed JSON, missing keys, and unexpected types are failures. Never pass an empty interpolation into a mutation command.

## Shell operators

`&&` runs commands in order and stops after the first failure. `||` selects a fallback after failure. Neither operator creates parallel work. Use Task steps for supported parallel execution, and keep Git operations sequential.

## Secrets and confirmation

Do not interpolate secrets, `.env` contents, tokens, or raw logs into commands. Require confirmation before force-push, destructive cleanup, merge, issue closure, or resource deletion. Automated Tasks must stop when confirmation is required instead of assuming consent.
