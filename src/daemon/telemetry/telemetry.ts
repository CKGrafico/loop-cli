import type {
  TelemetryStatus,
  LoopTelemetryInput,
  TaskTelemetryInput,
  CommandTelemetryInput,
  RetryTelemetryInput,
  ChildTelemetryContext,
  AgentUsage,
  CommandInvocation,
} from "./telemetry-types.js";

/**
 * Core telemetry abstraction. The execution engine depends on this,
 * not directly on @opentelemetry/* packages.
 */
export interface Telemetry {
  /** Start a root loop run span */
  startLoop(input: LoopTelemetryInput): TelemetrySpan;
  /** Start a task execution span (child of loop) */
  startTask(input: TaskTelemetryInput, parent?: TelemetrySpan): TelemetrySpan;
  /** Start a command execution span (child of task) */
  startCommand(input: CommandTelemetryInput, parent?: TelemetrySpan): TelemetrySpan;
  /** Record a retry within a task */
  recordRetry(input: RetryTelemetryInput): void;
  /** Record a failure on the current active span */
  recordFailure(error: unknown, attributes?: Record<string, unknown>): void;
  /** Record agent usage data (tokens, cost) */
  recordAgentUsage(input: AgentUsage, span?: TelemetrySpan): void;
  /** Emit a structured log record to the OTLP logs pipeline */
  logEvent(
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal",
    message: string,
    attributes?: Record<string, string | number | boolean>,
  ): void;
  /** Prepare environment variables for a child process */
  prepareChildProcess(
    invocation: import("./telemetry-types.js").CommandInvocation,
    context: import("./telemetry-types.js").ChildTelemetryContext,
    integrationOverride?: "auto" | "opencode" | "claude-code" | "generic" | "none",
  ): import("./telemetry-types.js").PreparedChildProcessTelemetry;
  /** Get current telemetry status */
  getStatus(): TelemetryStatus;
  /** Flush pending telemetry */
  flush(): Promise<void>;
  /** Shutdown telemetry gracefully */
  shutdown(): Promise<void>;
}

/**
 * A traced span with lifecycle methods.
 */
export interface TelemetrySpan {
  /** Set an attribute on this span */
  setAttribute(key: string, value: string | number | boolean): void;
  /** Set multiple attributes */
  setAttributes(attrs: Record<string, string | number | boolean>): void;
  /** Record an error on this span */
  recordError(error: unknown): void;
  /** Mark this span as successful and end it */
  ok(): void;
  /** End the span (with optional status) */
  end(status?: "ok" | "error" | "cancelled"): void;
  /** Get the trace context for child process propagation */
  getTraceContext(): { traceParent?: string; traceState?: string };
}
