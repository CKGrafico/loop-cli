---
metadata:
  internal: true
name: ob-plan-archive
description: Archive a completed OpenSpec change and update documentation. Interactive mode finds the oldest merged unarchived change and opens an archive PR; autonomous mode archives a named change in place on the current branch. Invoked by the /plan-archive command (interactive) and the plan-goal pipeline (autonomous).
license: MIT
---

# Plan Archive

## Input

The caller provides (all optional):
- A mode (see below). Default: `interactive`.
- In autonomous mode: the change id to archive (required in that mode; the caller knows which change it just implemented).

## Modes

- interactive (default): full flow below. Find the oldest unarchived change with a completed PR, confirm with the user, archive it, update docs with approval, and open an archive PR. No input required.
- autonomous: the caller names the change to archive. Skip the working-tree prep, the PR lookup, the confirmation prompt, and the archive-PR step. Instead, archive in place on the current branch:
  1. Archive the change by its id. Prefer the `@openspec-archive-change` skill if it is available. If it is not available, run the CLI directly, and it must be non-interactive, because there is no user to answer prompts:

     ```bash
     openspec archive "<change-id>" -y
     ```

     `-y` skips the confirmation prompt (without it the command blocks forever in an unattended run). Add `--skip-specs` only for infra/tooling/doc-only changes that produced no spec deltas. If the command reports the change is already archived, treat that as success.
  2. Verify the archive actually moved. The change folder must no longer exist at `openspec/changes/<change-id>/`, and a dated copy must now exist under `openspec/changes/archive/` (the CLI renames it to `archive/YYYY-MM-DD-<change-id>/`):

     ```bash
     REPO_ROOT="$(git rev-parse --show-toplevel)"
     test ! -d "$REPO_ROOT/openspec/changes/<change-id>" \
       && ls -d "$REPO_ROOT/openspec/changes/archive/"*"<change-id>" >/dev/null 2>&1 \
       && echo ARCHIVED_OK || echo ARCHIVE_FAILED
     ```

      If this prints `ARCHIVE_FAILED`, run the archive once more and repeat the check. If it still fails, report it to the caller as a failure; do not pretend it succeeded.
  3. Compare the archived change's specs against `ARCHITECTURE.md` and `DESIGN.md`; apply any needed doc updates directly (no approval prompt).
  4. If the change was a bug fix or new functionality with important impact, check if `@ob-guardrails-project` exists and update it.
  5. Do not commit or push: the caller owns the git operations.
   6. The ARCHIVE stage is complete. Hand control back to the caller (the `/plan-goal` pipeline) so it continues with evidence and output. Do not stop or end the turn here; archiving is not the end of the run.

---

## Interactive flow

Steps

1. Prepare working tree

   ```bash
   REPO_ROOT="$(git rev-parse --show-toplevel)"
   DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')"
   [ -z "$DEFAULT_BRANCH" ] && DEFAULT_BRANCH="main"
   ```

   1. If the tree has uncommitted changes: `git stash push -u -m "WIP before archive"` and tell the user their work is stashed (it is restored in step 6).
   2. Sync the default branch (skip the pull if there is no `origin` remote):

   ```bash
   git switch "$DEFAULT_BRANCH" && git pull origin "$DEFAULT_BRANCH"
   ```

<!-- OB-PLATFORM-ARCHIVE-START -->
2. **Find the oldest change with a completed PR**

   List unarchived changes (top-level only, excludes `archive/`):

   ```bash
   find "$REPO_ROOT/openspec/changes" -mindepth 1 -maxdepth 1 -type d -not -name 'archive' | sort
   ```

   If empty, report a blocker and stop.

   List completed PRs:

   ```bash
   gh pr list --repo {owner}/{repo} --state merged --json title,headRefName,mergedAt,number --jq 'sort_by(.mergedAt) | .[] | {name: .title, sourceRefName: .headRefName, mergedAt: .mergedAt, pullRequestId: .number}'
   ```

   Match each change to a completed PR using its ID and slug as search hints:
   - No match → skip (record as blocked: `no merged PR found`).
   - One match → eligible.
   - Multiple matches → ask the user which PR belongs to that change.

   If nothing is eligible, report a blocker and stop. Otherwise select the eligible change with the **oldest** PR `mergedAt` as the candidate.

3. **Confirm the candidate**

   Show the candidate (ID, title, PR ID, merged date) and any blocked changes, then ask:

   ```text
   Oldest unarchived merged change found:
     ID: {change-id}
     Title: {title from resolved PR}
     PR ID: {pullRequestId}
     Merged: {mergedAt}

   Proceed with archiving? [yes/no]
   ```

   Stop if the user does not confirm.

4. **Archive the change**

   ```bash
   git checkout -b archive/{change-id}
   ```

   Load `@openspec-archive-change` skill and follow it to archive the change.

5. **Update docs**

   Compare the archived change's specs against `ARCHITECTURE.md` and `DESIGN.md`. If updates are needed, show them and get user approval before applying.

6. **Create the archive PR**

   ```bash
   git add -A
   git commit -m "archive: {title} ({change-id})"
   git push origin archive/{change-id}

   gh pr create \
      --repo {owner}/{repo} \
      --base "$DEFAULT_BRANCH" \
      --head archive/{change-id} \
      --title "archive: {title} ({change-id})" \
      --body "Archive SDD artifacts for {change-id} after merge."
   ```

   If work was stashed in step 1, restore it after the PR is created unless the user opts out.

7. **Report**

   Display:

   ```text
   Archive complete

     Change ID: {change-id}
     Title: {title}
     Original PR: {original-pr-link}
     Archive PR: {archive-pr-link}

     Documentation updates:
     - ARCHITECTURE.md: {count} changes applied
     - DESIGN.md: {count} changes applied
   ```

## Rules

- All OpenSpec paths resolve from `git rev-parse --show-toplevel`. Never use `/openspec/...`.
- Only process top-level directories in `$REPO_ROOT/openspec/changes/`; exclude `archive/`.
- Use change ID and slug only as search hints; do not assume the source branch name.
- The oldest eligible merged change is the only candidate: never ask the user which change to archive (but do ask which PR if multiple match one change).
- Never proceed if the selected PR is not completed.
- Never use browser tools or direct web requests for GitHub. Use `gh` CLI only.
- Never invent or guess PR, branch, or merge metadata.
<!-- OB-PLATFORM-ARCHIVE-END -->
