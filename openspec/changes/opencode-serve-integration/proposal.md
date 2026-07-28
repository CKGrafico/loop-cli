## Why

Every recipe task that invokes `opencode run` pays a 30-90 second cold-start penalty: booting the opencode runtime, loading skills, initializing the OTLP SDK, and registering tracer/meter/logger providers. For loops on 20-minute cadences this is noise, but for rapid-fire tasks (PR feedback, verify-and-fix cycles, chained implement-then-verify) the cold start dominates wall-clock time. `opencode serve` and `opencode run --attach` already exist and are documented for exactly this use case ("to avoid MCP server cold boot times on every run"). Loop-task should manage the serve sidecar lifecycle so recipes get the warm-start benefit transparently.

## What Changes

- Add a persistent `opencode serve` sidecar managed by the loop-task daemon. The daemon starts it on boot, health-checks it, restarts on crash, and shuts it down gracefully.
- When the command-runner detects an `opencode run` invocation (same detection point already used for telemetry), it calls `ensureServe()` and injects `--attach http://localhost:4096` into the run args before `execa()`.
- Static OTEL telemetry config (endpoint, protocol, exporters, resource attributes, activation flag) moves to the serve process env, set once at startup. Per-task dynamic context (`TRACEPARENT`, `TRACESTATE`) stays on the `run --attach` client.
- Claude Code's `claude -p` does not have an equivalent `--attach` flag, so it stays on the current per-task model until Claude adds serve-attach support.
- Recipes require zero changes. Numa requires zero changes. Opencode requires zero changes.

## Non-goals

- Changing the recipe schema or command-runner's `execa → exit code` contract.
- Implementing a serve-client for Claude Code (blocked on Claude CLI feature parity).
- Moving loop-task's own telemetry (loop/task/command spans) into the serve process — loop-task keeps its own OTLP SDK instance.
- Supporting multiple concurrent serve instances or per-branch worktrees.

## Capabilities

### New Capabilities
- `agent-serve-lifecycle`: Daemon-managed lifecycle for persistent AI agent serve processes (start, health-check, restart, shutdown) and transparent `--attach` injection into `opencode run` commands.

### Modified Capabilities
- `opentelemetry`: Telemetry env injection in `prepareChildProcess` is simplified when serve is alive — static OTEL config is skipped, only W3C trace context remains per-task.

## Impact

- **New files**: `src/daemon/telemetry/agent-serve-manager.ts`, `tests/telemetry-serve-integration.test.ts`
- **Modified files**: `src/daemon/telemetry/agent-integrations/agent-integration.ts` (interface), `src/daemon/telemetry/agent-integrations/opencode-integration.ts` (serve impl), `src/daemon/telemetry/agent-integrations/claude-code-integration.ts` (no-op stub), `src/core/command/command-runner.ts` (serve detection + arg injection), `src/daemon/telemetry/open-telemetry-adapter.ts` (simplified env), `src/daemon/index.ts` (daemon lifecycle wiring)
- **Docs**: `docs/content/docs/opentelemetry.mdx` updated with serve model (telemetry env split, serve lifecycle, fallback behavior, troubleshooting), plus cross-references in `configuration.mdx` and `troubleshooting.mdx`
- **Dependencies**: No new npm packages
- **IPC contract**: No changes to `src/types.ts`
- **Persisted state**: No changes to LoopMeta or settings.json shape (serve port is a constant, not a setting, in this iteration)
- **Cross-platform**: Serve process spawn uses the same `execa` path as command-runner; health check uses `fetch` (available in Node 20+)
