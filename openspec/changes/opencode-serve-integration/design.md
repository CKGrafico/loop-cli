## Context

Loop-task's command-runner spawns a fresh process for every recipe task via `execa()`. When the task is `opencode run`, the opencode runtime boots from scratch each time: loading skills, initializing the OTLP SDK, registering tracer/meter/logger providers. This takes 30-90 seconds per invocation.

Opencode already supports a persistent server model: `opencode serve --port 4096` starts a long-running HTTP server, and `opencode run --attach http://localhost:4096 "..."` connects to it as a thin client. The opencode docs explicitly recommend this "to avoid MCP server cold boot times on every run."

Loop-task already detects `opencode run` invocations in `command-runner.ts` for telemetry agent integration. The same detection point can inject `--attach` arguments.

## Goals / Non-Goals

**Goals:**
- Daemon starts and manages a persistent `opencode serve` sidecar
- Command-runner transparently injects `--attach` into `opencode run` args when serve is alive
- Static OTEL telemetry config moves to serve env (set once); per-task TRACEPARENT stays on the run client
- Recipes and Numa code require zero changes
- Graceful serve lifecycle: start, health-check, restart on crash, shutdown

**Non-Goals:**
- Changing the `execa → exit code` contract
- Implementing serve-client for Claude Code (no `--attach` equivalent exists)
- Supporting multiple concurrent serve instances or per-branch worktrees
- Making serve port configurable via settings (fixed 4096 in this iteration)
- Moving loop-task's own telemetry spans into the serve process

## Decisions

### D1: Detection and injection in the agent integration layer, not in command-runner core

The existing `detectAgentIntegration()` in `command-runner.ts` already identifies `opencode run`. The `AgentTelemetryIntegration` interface already has a `prepare()` method that modifies env. We extend the interface with optional serve lifecycle methods (`ensureServe`, `isServeAlive`, `prepareRunArgs`) rather than hardcoding opencode-specific logic in command-runner.

**Alternative considered:** Hardcode serve detection in command-runner. Rejected because it breaks the strategy pattern and makes Claude Code integration harder later.

### D2: Serve env gets all static OTEL config; run client gets only TRACEPARENT

When serve is alive, `prepareChildProcess()` skips `OTEL_EXPORTER_OTLP_*`, `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`, `OTEL_RESOURCE_ATTRIBUTES` (static), and `OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY`. Only `TRACEPARENT` and `TRACESTATE` are injected per-task.

**Alternative considered:** Keep injecting all OTEL env on the run client too. Rejected because it's redundant — the serve process already has OTLP configured, and the run client is just an HTTP client that delegates work to serve.

### D2b: prepareRunArgs injects both --attach and --dir

When `opencode run --attach` connects to serve, the serve process does the actual file operations, not the run client. So `prepareRunArgs()` must inject `--attach http://localhost:4096` AND `--dir <cwd>` to ensure the serve operates in the correct working directory. The cwd comes from the recipe task's `cwd` field, which already flows through `command-runner.ts` to `execa()`.

### D3: AgentServeManager as a separate class owned by the daemon

A new `AgentServeManager` class handles start/health-check/restart/shutdown. It's instantiated in `daemon/index.ts` alongside `TelemetryManager`. It calls `ensureServe()` on daemon boot and `shutdownAll()` on daemon shutdown.

**Alternative considered:** Integrate serve lifecycle into `TelemetryManager`. Rejected because serve is about process lifecycle, not telemetry — telemetry is a side effect of the serve process having OTEL env.

### D4: Health check via `GET http://localhost:4096/global/health`

Opencode's server API exposes `GET /global/health` returning `{ healthy: true, version: string }`. The serve manager polls this endpoint with a 5-second timeout, retrying every 1 second for up to 120 seconds.

### D5: Serve port fixed at 4096 (opencode default)

Not configurable in this iteration. A constant in the opencode integration module. If the port is in use, `opencode serve` will fail and the manager logs a warning — tasks fall back to the current `opencode run` (no `--attach`) model.

### D6: TRACEPARENT propagation via env on the run --attach client

`opencode run --attach` is still spawned via `execa()`, so loop-task sets `TRACEPARENT` and `TRACESTATE` as env vars on the run process. Whether opencode's HTTP client forwards these as W3C `traceparent` headers to the serve process is an opencode implementation detail. If it doesn't, trace correlation still works through the parent-child span hierarchy (loop-task's command span has run.id and task.id; agent spans inherit the trace ID).

## Risks / Trade-offs

- **[Serve crash mid-task]** → AgentServeManager restarts serve; the current task's HTTP request fails, command-runner sees non-zero exit, chain routes to failure handler. No data loss.
- **[Stale file cache in serve]** → If serve caches file content between tasks, it could return stale results. Mitigated by opencode's own file watcher; if it doesn't invalidate, this is an opencode bug, not a loop-task bug.
- **[Port 4096 in use]** → Serve fails to start, manager logs warning, tasks fall back to cold start. No hard failure.
- **[TRACEPARENT not forwarded]** → Agent spans may not be children of the loop-task command span. Trace correlation relies on resource attributes and trace ID inheritance. Runtime verification needed on the VM.
- **[Memory growth in serve]** → Long-running process may accumulate memory. Mitigated by crash-restart in AgentServeManager; operator can restart the daemon to cycle the serve process.

## Migration Plan

1. Implement changes on `feature/opencode-serve-integration` branch
2. Run existing telemetry tests (must pass unchanged)
3. Deploy to VM, restart daemon, verify serve starts and `--attach` is injected
4. Run a recipe task, verify traces and metrics still flow through Otelite
5. Merge to main, publish, update global npm install on VM

## Documentation Updates

### `docs/content/docs/opentelemetry.mdx`

Update the "Agent Auto-Instrumentation" section:

- **Before**: "When a task executes a supported coding agent, loop-task automatically configures that agent's native OpenTelemetry support to route telemetry to the same OTLP endpoint."
- **After**: Add a subsection "Agent Serve Model" explaining:
  - When `opencode serve` is running, static OTEL config lives in the serve process env
  - `opencode run --attach` receives only `TRACEPARENT` per-task
  - Telemetry flow diagram: serve process → OTLP endpoint (static); run client → serve (dynamic trace context)
  - Update the support table row for OpenCode to note `--attach` injection
  - Note that Claude Code stays on the per-task model (no `--attach` equivalent yet)

### `docs/content/docs/opentelemetry.mdx` — new "Agent Serve Lifecycle" section

Add after "Agent Auto-Instrumentation":

```mdx
## Agent Serve Lifecycle

When the daemon starts, it manages a persistent `opencode serve` sidecar process
to eliminate per-task cold-start time.

### How it works

1. Daemon boots → AgentServeManager starts `opencode serve --port 4096`
2. Manager polls `GET http://localhost:4096/global/health` until ready
3. Recipe task invokes `opencode run --agent fullstack "..."`
4. Command-runner detects opencode integration → calls `ensureServe()`
5. Serve is alive → injects `--attach http://localhost:4096` into run args
6. `opencode run --attach` delegates work to the warm serve instance
7. Run client exits with normal exit code → chain routing unchanged

### Telemetry configuration split

| Scope | Where | Set when | What |
|-------|-------|-----------|------|
| Static | serve process env | Once at daemon boot | `OTEL_EXPORTER_OTLP_*`, `OTEL_*_EXPORTER`, `OTEL_RESOURCE_ATTRIBUTES`, `OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY` |
| Dynamic | run --attach client env | Per task | `TRACEPARENT`, `TRACESTATE` |

### Fallback behavior

If the serve process is not running (crash, port in use, opencode not installed),
loop-task falls back to the current `opencode run` model — no `--attach` injection,
all OTEL env injected per-task as before.

### Troubleshooting

- Check serve health: `curl http://localhost:4096/global/health`
- Check serve logs: look for `opencode serve` in the daemon log
- Verify `--attach` injection: enable debug logging, check command-runner output
```

### Other docs to cross-reference

- `docs/content/docs/configuration.mdx` — mention that agent serve port is 4096 (not configurable yet)
- `docs/content/docs/troubleshooting.mdx` — add "agent serve not starting" entry if a troubleshooting section exists

## Open Questions

- Does `opencode run --attach` forward `TRACEPARENT` from its env to the serve as a W3C HTTP header? Needs runtime verification.
- Should the serve port be configurable via `loop-task` settings in a future iteration? Likely yes, but not in scope now.
