## 1. Agent integration interface and OpenCode serve lifecycle

- [x] 1.1 Extend `AgentTelemetryIntegration` interface with optional serve lifecycle methods: `ensureServe?(cwd: string): Promise<ServeInfo | void>`, `isServeAlive?(): boolean`, `prepareRunArgs?(args: string[]): string[]`. Add `ServeInfo` type (`{ port: number; pid: number }`) to telemetry-types.ts. <!-- agent: fullstack-engineer.build, depends_on: [], touches: [src/daemon/telemetry/agent-integrations/agent-integration.ts, src/daemon/telemetry/telemetry-types.ts] -->

- [x] 1.2 Implement serve lifecycle in `OpenCodeTelemetryIntegration`: `ensureServe()` spawns `opencode serve --port 4096` with all static OTEL_* env vars, `isServeAlive()` polls `GET http://localhost:4096/global/health`, `prepareRunArgs()` injects `--attach http://localhost:4096` after `run` in the args array. Define `SERVE_PORT` constant (4096) in the integration module. <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [src/daemon/telemetry/agent-integrations/opencode-integration.ts] -->

- [x] 1.3 Mark `ClaudeCodeTelemetryIntegration` as serve-unsupported: do not implement serve lifecycle methods (leave them undefined). Add a code comment documenting that `claude -p` has no `--attach` equivalent. <!-- agent: fullstack-engineer.build, depends_on: [1.1], touches: [src/daemon/telemetry/agent-integrations/claude-code-integration.ts] -->

## 2. Command-runner serve detection and --attach injection

- [x] 2.1 Update `command-runner.ts`: after detecting an agent integration, if the integration has `ensureServe` and `isServeAlive`, call `ensureServe()` before `execa()`. If `isServeAlive()` returns true, call `prepareRunArgs()` to inject `--attach` into the args. Keep the `execa → exit code` contract unchanged. If serve is not alive, fall through to current behavior. <!-- agent: fullstack-engineer.build, depends_on: [1.2, 1.3], touches: [src/core/command/command-runner.ts] -->

- [x] 2.2 Simplify `prepareChildProcess()` in `open-telemetry-adapter.ts`: when serve is alive (check via integration `isServeAlive`), skip static OTEL_* env injection (`OTEL_EXPORTER_OTLP_*`, `OTEL_TRACES_EXPORTER`, `OTEL_METRICS_EXPORTER`, `OTEL_LOGS_EXPORTER`, `OTEL_RESOURCE_ATTRIBUTES`, `OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY`). Keep only `TRACEPARENT` and `TRACESTATE` per-task. When serve is not alive, use current behavior. <!-- agent: fullstack-engineer.build, depends_on: [2.1], touches: [src/daemon/telemetry/open-telemetry-adapter.ts] -->

## 3. Daemon lifecycle and AgentServeManager

- [x] 3.1 Create `AgentServeManager` class in `src/daemon/telemetry/agent-serve-manager.ts`: owns serve process lifecycle (start, health-check with 120s timeout and 1s poll interval, restart on crash, graceful shutdown with SIGTERM → 5s wait → SIGKILL). Takes `DaemonSettings` and `TelemetryManager` as constructor args. <!-- agent: fullstack-engineer.build, depends_on: [1.2], touches: [src/daemon/telemetry/agent-serve-manager.ts] -->

- [x] 3.2 Wire `AgentServeManager` into `daemon/index.ts`: instantiate after `TelemetryManager`, call `ensureServe()` on daemon boot, call `shutdownAll()` on daemon shutdown. Add serve manager to the existing shutdown handler chain. <!-- agent: fullstack-engineer.build, depends_on: [3.1], touches: [src/daemon/index.ts] -->

## 4. Tests

- [x] 4.1 Add `tests/telemetry-serve-integration.test.ts`: test `ensureServe()` spawns serve with correct OTEL env, test `isServeAlive()` returns true/false based on health endpoint mock, test `prepareRunArgs()` injects `--attach` correctly, test `prepareChildProcess()` skips static OTEL env when serve is alive, test fallback behavior when serve is not alive. Mock HTTP health endpoint. <!-- agent: fullstack-engineer.build, depends_on: [2.1, 2.2], touches: [tests/telemetry-serve-integration.test.ts] -->

## 5. Documentation

- [x] 5.1 Update `docs/content/docs/opentelemetry.mdx`: add "Agent Serve Lifecycle" section (how it works, telemetry config split table, fallback behavior, troubleshooting). Update "Agent Auto-Instrumentation" section to note `--attach` injection for OpenCode and that Claude Code stays per-task. Add the serve model flow diagram. <!-- agent: docs-ui-engineer.build, depends_on: [2.2, 3.2], touches: [docs/content/docs/opentelemetry.mdx] -->

- [x] 5.2 Add cross-references in `docs/content/docs/configuration.mdx` (note agent serve port is 4096) and `docs/content/docs/troubleshooting.mdx` (add "agent serve not starting" entry). <!-- agent: docs-ui-engineer.build, depends_on: [5.1], touches: [docs/content/docs/configuration.mdx, docs/content/docs/troubleshooting.mdx] -->

- [x] 5.3 Add "Observing Loop Task Agent Sessions" section to `docs/content/docs/opentelemetry.mdx` (or a new `docs/content/docs/agent-serve.mdx` page): document how to attach a TUI to the running serve instance to observe recipe task sessions live (`opencode attach http://localhost:4096`, `opencode session list`, `opencode -s <session-id> --attach http://localhost:4096`), the multi-client architecture diagram, and SSH/headless VM considerations. <!-- agent: docs-ui-engineer.build, depends_on: [5.1], touches: [docs/content/docs/opentelemetry.mdx] -->

## 6. OpenCode JSONL stream parsing and context.opencode.*

- [x] 6.1 Add `parseOpencodeJsonOutput(stdout: string): OpencodeContext` function in `src/core/context/opencode-json-parser.ts`: parse JSONL event stream from `opencode run --format json`. Extract `step_start` (sessionID, messageID, snapshot), accumulate `tool_use` events (count, tool names), capture last `text` event before `step_finish` with `reason: "stop"` (Option B — agent final summary only), accumulate `step_finish` tokens/cost (sum across all steps), capture `error` events. Return structured `OpencodeContext` object. <!-- agent: fullstack-engineer.build, depends_on: [], touches: [src/core/context/opencode-json-parser.ts] -->

- [x] 6.2 Add `OpencodeContext` type to `src/core/context/types.ts`: `{ session: { id: string; messageId: string }, tokens: { input: number; output: number; reasoning: number; cache: { read: number; write: number } }, cost: number, tools: { count: number; names: string[] }, gitSnapshot: string, error: { name: string; message: string } | null, text: string | null }`. <!-- agent: fullstack-engineer.build, depends_on: [], touches: [src/core/context/types.ts] -->

- [x] 6.3 Update `command-runner.ts`: when the detected agent integration is `opencode`, auto-inject `--format json` into args if not already present. After command completes, if stdout is JSONL (detected by first line being valid JSON with a `type` field), parse it with `parseOpencodeJsonOutput()` and merge into context as `context.opencode.*`. Non-JSON stdout falls through to current behavior unchanged. <!-- agent: fullstack-engineer.build, depends_on: [6.1, 6.2, 2.1], touches: [src/core/command/command-runner.ts] -->

- [x] 6.4 Update `context-parser.ts` to support nested `opencode.*` context keys: `{{opencode.session.id}}`, `{{opencode.tokens.input}}`, `{{opencode.tokens}}` (renders indented JSON), `{{opencode.cost}}`, `{{opencode.tools.count}}`, `{{opencode.error}}`. When a context value is an object, `JSON.stringify(value, null, 2)` is used for interpolation. <!-- agent: fullstack-engineer.build, depends_on: [6.1, 6.2], touches: [src/core/context/context-parser.ts] -->

## 7. Loop Task skills documentation

- [x] 7.1 Update `.agents/skills/loop-task-tasks/references/ai-agent-patterns.md`: add "OpenCode serve model" section documenting: (1) `opencode run` auto-detects serve via loop-task daemon, (2) `--format json` is auto-injected, (3) `context.opencode.*` keys available after opencode tasks (`session.id`, `tokens.*`, `cost`, `tools.*`, `gitSnapshot`, `error`, `text`), (4) how to chain sessions with `--session {{opencode.session.id}}` within the same loop chain (not between loops), (5) how to include token info in PR comments. <!-- agent: docs-ui-engineer.build, depends_on: [6.3, 5.1], touches: [.agents/skills/loop-task-tasks/references/ai-agent-patterns.md] -->

- [x] 7.2 Update `.agents/skills/loop-task-tasks/references/recipes.md`: add recipe examples showing opencode serve integration patterns: (1) implement → fix-tests with `--session {{opencode.session.id}}`, (2) PR creation with `{{opencode.tokens}}` and `{{opencode.cost}}` in body, (3) error handling with `{{opencode.error}}`. <!-- agent: docs-ui-engineer.build, depends_on: [6.3, 6.4, 7.1], touches: [.agents/skills/loop-task-tasks/references/recipes.md] -->
