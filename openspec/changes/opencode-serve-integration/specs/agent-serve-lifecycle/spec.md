## ADDED Requirements

### Requirement: Daemon manages persistent agent serve process

The daemon SHALL start and manage a persistent `opencode serve` sidecar process on daemon boot. The serve process SHALL be started with all static OTEL environment variables (endpoint, protocol, exporters, resource attributes, activation flag). The daemon SHALL health-check the serve process by polling `GET http://localhost:4096/global/health` until it responds with `{ healthy: true }` or a 120-second timeout is reached.

#### Scenario: Daemon starts opencode serve on boot

- **WHEN** the daemon starts and opencode is installed
- **THEN** the daemon spawns `opencode serve --port 4096` with OTEL_* env vars
- **AND** polls the health endpoint until it responds or times out
- **AND** logs the serve status

#### Scenario: Serve is already running

- **WHEN** the daemon starts and `GET http://localhost:4096/global/health` already returns healthy
- **THEN** the daemon does not spawn a new serve process
- **AND** reuses the existing serve instance

#### Scenario: Serve health check times out

- **WHEN** the serve process is spawned but the health endpoint does not respond within 120 seconds
- **THEN** the daemon logs a warning
- **AND** recipe tasks fall back to `opencode run` without `--attach`

### Requirement: Command-runner injects --attach when serve is alive

When the command-runner detects an `opencode run` invocation AND the serve process is alive, it SHALL inject `--attach http://localhost:4096` into the command arguments before calling `execa()`. When the serve is not alive, the command-runner SHALL NOT inject `--attach` and SHALL fall back to the current per-task model.

#### Scenario: Serve alive, opencode run detected

- **WHEN** a recipe task invokes `opencode run --agent fullstack "do work"`
- **AND** the serve health endpoint returns healthy
- **THEN** the command-runner injects `--attach http://localhost:4096` after `run` in the args
- **AND** the modified command becomes `opencode run --attach http://localhost:4096 --agent fullstack "do work"`

#### Scenario: Serve not alive, opencode run detected

- **WHEN** a recipe task invokes `opencode run --agent fullstack "do work"`
- **AND** the serve health endpoint is unreachable
- **THEN** the command-runner does NOT inject `--attach`
- **AND** the command runs as `opencode run --agent fullstack "do work"` (current behavior)

#### Scenario: Non-opencode command

- **WHEN** a recipe task invokes `sh -c 'gh issue list ...'`
- **THEN** no serve detection or injection occurs
- **AND** the command runs unchanged

### Requirement: Serve process restart on crash

The daemon SHALL monitor the serve process. If the serve process crashes (exits unexpectedly), the daemon SHALL restart it and wait for health before marking it as alive again.

#### Scenario: Serve crashes during operation

- **WHEN** the serve process exits with a non-zero code while the daemon is running
- **THEN** the daemon logs the crash
- **AND** restarts the serve process
- **AND** polls the health endpoint until ready or timeout

### Requirement: Serve graceful shutdown

When the daemon shuts down, it SHALL gracefully stop all managed serve processes by sending SIGTERM, waiting up to 5 seconds, then SIGKILL if the process has not exited.

#### Scenario: Daemon shutdown stops serve

- **WHEN** the daemon receives a shutdown signal
- **THEN** the daemon sends SIGTERM to the serve process
- **AND** waits up to 5 seconds for the process to exit
- **AND** sends SIGKILL if the process is still alive after 5 seconds

### Requirement: AgentTelemetryIntegration interface supports serve lifecycle

The `AgentTelemetryIntegration` interface SHALL include optional methods for serve lifecycle management: `ensureServe(cwd)`, `isServeAlive()`, and `prepareRunArgs(args)`. Integrations that do not support serve (e.g., Claude Code) SHALL leave these methods undefined.

#### Scenario: OpenCode integration implements serve methods

- **WHEN** the OpenCodeTelemetryIntegration is instantiated
- **THEN** it provides `ensureServe()`, `isServeAlive()`, and `prepareRunArgs()` implementations
- **AND** `ensureServe()` spawns `opencode serve --port 4096` with OTEL_* env
- **AND** `isServeAlive()` calls `GET http://localhost:4096/global/health`
- **AND** `prepareRunArgs()` injects `--attach http://localhost:4096` into the args array

#### Scenario: Claude Code integration does not support serve

- **WHEN** the ClaudeCodeTelemetryIntegration is instantiated
- **THEN** serve lifecycle methods are undefined
- **AND** command-runner skips serve injection for `claude -p` commands
