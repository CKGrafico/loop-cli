## MODIFIED Requirements

### Requirement: Agent auto-instrumentation configures telemetry env

When a task executes a supported coding agent, loop-task automatically configures that agent's native OpenTelemetry support to route telemetry to the same OTLP endpoint.

When the agent serve sidecar is alive, static OTEL configuration (endpoint, protocol, exporters, resource attributes, activation flag) SHALL be set once on the serve process env, not per-task. Per-task dynamic context (`TRACEPARENT`, `TRACESTATE`) SHALL still be injected on the run client.

When the serve is not alive, the current per-task env injection behavior SHALL be used as fallback.

#### Scenario: Serve alive, opencode run task

- **WHEN** a recipe task invokes `opencode run` and the serve is alive
- **THEN** the run client receives only `TRACEPARENT` and `TRACESTATE` in its env
- **AND** static OTEL config is NOT injected per-task (it lives in the serve process)

#### Scenario: Serve not alive, opencode run task

- **WHEN** a recipe task invokes `opencode run` and the serve is not alive
- **THEN** the run client receives all OTEL_* env vars per-task (current behavior)
- **AND** `OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY=true` is injected

#### Scenario: Claude Code task (always per-task)

- **WHEN** a recipe task invokes `claude -p` or `claude --print`
- **THEN** all OTEL_* env vars are injected per-task (no serve support)
- **AND** `CLAUDE_CODE_ENABLE_TELEMETRY=1` is injected
