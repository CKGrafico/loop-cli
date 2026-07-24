# Verification Gates

Verification proves that a Task produced the expected repository state. It is concrete, deterministic, and independent from an AI Task's summary.

## Contract

A verification Task must:

- exit `0` only when every check passes;
- exit non-zero when output is malformed, schema is unexpected, work remains, lint fails, or types fail;
- run after the work Task and before finalization;
- route failure to recovery instead of finalization;
- use named JSON fields and semantic predicates, never serialized JSON string comparison;
- declare shell-specific dependencies when it cannot use a portable command.

## OpenSpec completion check

`openspec list --json` returns an object:

```json
{ "changes": [] }
```

Use a shell Task on POSIX systems. Keep the whole pipeline inside `sh -c`:

```sh
sh -c 'openspec list --json | python3 -c ''import sys,json; exit(0 if len(json.load(sys.stdin).get("changes",[]))==0 else 1)'''
```

Do not store `openspec list --json | python3 ...` as one ordinary command. Loop Task passes command arguments directly unless the Task explicitly invokes a shell. On Windows, use the PowerShell equivalent or a project script supplied by the repository.

## Verification levels

Quick gate for code changes:

```sh
sh -c 'openspec list --json | python3 -c ''import sys,json; exit(0 if len(json.load(sys.stdin).get("changes",[]))==0 else 1)'' && pnpm exec eslint --max-warnings 0 src/ tests/ && pnpm exec tsc --noEmit'
```

Full repository gate:

```sh
sh -c 'openspec list --json | python3 -c ''import sys,json; exit(0 if len(json.load(sys.stdin).get("changes",[]))==0 else 1)'' && pnpm exec eslint --max-warnings 0 src/ tests/ && pnpm exec tsc --noEmit && pnpm run test && pnpm run build'
```

Prefer existing `package.json` scripts when they express the required check. Do not add `npx` to a canonical command when the repository declares another package manager.

## Temporary verification artifacts

When verification or evidence capture needs intermediate output, keep it inside
the repository under an ignored directory such as `.loop-task-tmp/`. Never use
`/tmp` or another external directory: hosted runners may reject access to it,
and the evidence step may run in a different permission boundary.

```sh
sh -c 'set -eu; tmpDir=".loop-task-tmp/verify-$$"; mkdir -p "$tmpDir"; pnpm exec tsc --noEmit >"$tmpDir/typecheck.log" 2>&1 && pnpm test >"$tmpDir/test.log" 2>&1'
```

Use a PID-suffixed directory so concurrent loops do not overwrite one another.
The directory must be listed in `.gitignore` before the verification Task runs.
Keep failure logs when useful; clean successful artifacts in a later cleanup
Task or at the end of the same shell script.

## Chain placement

```text
work → verify → finalize
  └── failure → recover
```

An AI Task exiting `0` means only that the runner completed. It does not prove that the requested change is correct.
