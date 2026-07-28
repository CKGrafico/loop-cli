/**
 * Internal telemetry types used by the daemon telemetry system.
 * These are NOT the same as DaemonSettings telemetry fields — they are
 * the runtime representations used by TelemetryManager and adapters.
 */

/** Stable span names — never include dynamic identifiers */
export const SPAN_NAMES = {
  LOOP_RUN: "loop_task.loop.run",
  LOOP_RESOLVE: "loop_task.loop.resolve",
  TASK_EXECUTE: "loop_task.task.execute",
  COMMAND_EXECUTE: "loop_task.command.execute",
  AGENT_EXECUTE: "loop_task.agent.execute",
  GIT_COMMIT: "loop_task.git.commit",
  GITHUB_ISSUE_UPDATE: "loop_task.github.issue.update",
  GITHUB_PR_CREATE: "loop_task.github.pull_request.create",
} as const;

/** Correlation attribute keys */
export const CORRELATION_KEYS = {
  RUN_ID: "loop_task.run.id",
  LOOP_ID: "loop_task.loop.id",
  LOOP_NAME: "loop_task.loop.name",
  TASK_ID: "loop_task.task.id",
  TASK_NAME: "loop_task.task.name",
  PROJECT_ID: "loop_task.project.id",
  PROJECT_NAME: "loop_task.project.name",
  AGENT_INTEGRATION: "loop_task.agent.integration",
} as const;

/** Metric names — bounded cardinality */
export const METRIC_NAMES = {
  RUNS: "loop_task.runs",
  RUN_DURATION: "loop_task.run.duration",
  TASKS: "loop_task.tasks",
  TASK_DURATION: "loop_task.task.duration",
  TASK_RETRIES: "loop_task.task.retries",
  COMMANDS: "loop_task.commands",
  COMMAND_DURATION: "loop_task.command.duration",
  AGENT_EXECUTIONS: "loop_task.agent.executions",
  AGENT_DURATION: "loop_task.agent.duration",
  AGENT_INPUT_TOKENS: "loop_task.agent.input_tokens",
  AGENT_OUTPUT_TOKENS: "loop_task.agent.output_tokens",
  AGENT_CACHE_READ_TOKENS: "loop_task.agent.cache_read_tokens",
  AGENT_CACHE_WRITE_TOKENS: "loop_task.agent.cache_write_tokens",
  AGENT_COST: "loop_task.agent.cost",
  FAILURES: "loop_task.failures",
} as const;

/** Telemetry status model */
export type ExporterState =
  | "disabled"
  | "not-configured"
  | "configured"
  | "healthy"
  | "unavailable";

export interface TelemetryStatus {
  enabled: boolean;
  exporterConfigured: boolean;
  endpoint?: string;
  protocol: "grpc" | "http/protobuf";
  serviceName: string;
  autoInstrumentAgents: boolean;
  captureContent: boolean;
  captureCommandOutput: boolean;
  exporterState: ExporterState;
  lastSuccessfulExportAt?: string;
  lastExportError?: string;
}

/** Input types for starting spans */
export interface LoopTelemetryInput {
  loopId: string;
  loopName: string;
  runId: string;
  projectId?: string;
  projectName?: string;
}

export interface TaskTelemetryInput {
  taskId: string;
  taskName: string;
  runId: string;
  loopId: string;
  loopName: string;
  projectId?: string;
  projectName?: string;
}

export interface CommandTelemetryInput {
  command: string;
  commandLine: string;
  argumentCount: number;
  cwd: string;
  runId: string;
  loopId: string;
  taskId?: string;
  taskName?: string;
  integrationId?: string;
}

export interface RetryTelemetryInput {
  attempt: number;
  maxAttempts: number;
  runId: string;
  loopId: string;
  taskId?: string;
}

/** Child process telemetry context — passed to agent integrations */
export interface ChildTelemetryContext {
  runId: string;
  loopId: string;
  loopName: string;
  taskId?: string;
  taskName?: string;
  projectId?: string;
  projectName?: string;
  traceParent?: string;
  traceState?: string;
}

/** Prepared child process telemetry — merged into child env */
export interface PreparedChildProcessTelemetry {
  env: Record<string, string>;
  integrationId?: string;
}

/** Agent usage data parsed from command output */
export interface AgentUsage {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  costUsd?: number;
  provider?: string;
  model?: string;
  sessionId?: string;
  integration?: string;
}

/** Per-task telemetry override */
export interface TaskTelemetryConfig {
  enabled?: boolean;
  integration?: "auto" | "opencode" | "claude-code" | "generic" | "none";
}

/** Command invocation for agent detection */
export interface CommandInvocation {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
}

/** Prepared command after agent integration */
export interface PreparedCommandInvocation {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** Command result for usage parsing */
export interface CommandResult {
  exitCode: number;
  stdout?: string;
  duration: number;
}

/** Information about a running agent serve process */
export interface ServeInfo {
  port: number;
  pid: number;
  url: string;
}
