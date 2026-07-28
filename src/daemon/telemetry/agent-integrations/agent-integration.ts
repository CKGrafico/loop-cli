import type {
  CommandInvocation,
  PreparedCommandInvocation,
  ChildTelemetryContext,
  AgentUsage,
  CommandResult,
  ServeInfo,
} from "../telemetry-types.js";

/**
 * An agent telemetry integration detects a supported coding agent CLI
 * and prepares its invocation to route telemetry through loop-task's
 * unified OTLP destination.
 */
export interface AgentTelemetryIntegration {
  /** Unique identifier for this integration */
  readonly id: string;

  /**
   * Detect whether the given command matches this agent.
   * Must handle absolute paths, Windows suffixes, common shell invocation.
   */
  matches(command: string, args: string[]): boolean;

  /**
   * Prepare the command invocation for telemetry.
   * May modify env, cannot mutate global process.env.
   * May NOT modify command/args in ways that break expected output.
   */
  prepare(
    invocation: CommandInvocation,
    context: ChildTelemetryContext,
  ): PreparedCommandInvocation;

  /**
   * Optionally parse agent usage from command output.
   * Must not force --format json when it would break output contract.
   */
  parseUsage?(result: CommandResult): AgentUsage | undefined;

  /**
   * Optionally start a persistent serve process for this agent.
   * Called by AgentServeManager on daemon boot and on restart after crash.
   * Returns ServeInfo if serve was started or is already running, void if not supported.
   */
  ensureServe?(cwd: string, env: Record<string, string>): Promise<ServeInfo | void>;

  /**
   * Check whether the serve process is alive and healthy.
   * Returns true if serve is running and responding to health checks.
   */
  isServeAlive?(): boolean;

  /**
   * Inject serve-specific arguments (e.g., --attach, --dir) into the command args
   * when serve is alive. Returns the modified args array.
   */
  prepareRunArgs?(args: string[], cwd?: string): string[];

  /**
   * Gracefully shut down the serve process.
   * Called by AgentServeManager on daemon shutdown.
   */
  shutdownServe?(): Promise<void>;
}
