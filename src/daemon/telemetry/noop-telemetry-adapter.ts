import type { Telemetry, TelemetrySpan } from "./telemetry.js";
import type {
  TelemetryStatus,
  PreparedChildProcessTelemetry,
} from "./telemetry-types.js";

class NoopSpan implements TelemetrySpan {
  setAttribute(): void {}
  setAttributes(): void {}
  recordError(): void {}
  ok(): void {}
  end(): void {}
  getTraceContext(): { traceParent?: string; traceState?: string } {
    return {};
  }
}

/**
 * No-op telemetry adapter. Used when telemetry is disabled or
 * when no endpoint is configured. All operations are safe no-ops.
 */
export class NoopTelemetryAdapter implements Telemetry {
  private status: TelemetryStatus;

  constructor(statusOverrides?: Partial<TelemetryStatus>) {
    this.status = {
      enabled: false,
      exporterConfigured: false,
      endpoint: undefined,
      protocol: "http/protobuf",
      serviceName: "loop-task",
      autoInstrumentAgents: false,
      captureContent: false,
      captureCommandOutput: false,
      exporterState: "disabled",
      ...statusOverrides,
    };
  }

  startLoop(): TelemetrySpan {
    return new NoopSpan();
  }

  startTask(): TelemetrySpan {
    return new NoopSpan();
  }

  startCommand(): TelemetrySpan {
    return new NoopSpan();
  }

  recordRetry(): void {}

  recordFailure(): void {}

  recordAgentUsage(): void {}

  logEvent(): void {}

  prepareChildProcess(
    _invocation?: import("./telemetry-types.js").CommandInvocation,
    _context?: import("./telemetry-types.js").ChildTelemetryContext,
    _integrationOverride?: "auto" | "opencode" | "claude-code" | "generic" | "none",
  ): PreparedChildProcessTelemetry {
    return { env: {} };
  }

  getStatus(): TelemetryStatus {
    return { ...this.status };
  }

  updateStatus(partial: Partial<TelemetryStatus>): void {
    this.status = { ...this.status, ...partial };
  }

  async flush(): Promise<void> {}

  async shutdown(): Promise<void> {}
}
