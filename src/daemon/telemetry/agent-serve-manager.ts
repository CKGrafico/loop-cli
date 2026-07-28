import type { DaemonSettings } from "../../types.js";
import type { TelemetryManager } from "./telemetry-manager.js";
import { daemonLog } from "../daemon-log.js";
import { getAgentIntegrations } from "./agent-integrations/index.js";
import type { AgentTelemetryIntegration } from "./agent-integrations/agent-integration.js";

/**
 * Manages the lifecycle of persistent agent serve sidecars (e.g., opencode serve).
 *
 * On daemon boot, starts serve processes for integrations that support them.
 * On daemon shutdown, gracefully stops all serve processes.
 *
 * The serve manager is the single owner of serve process lifecycle.
 * The TelemetryManager and command-runner reference the integration's
 * isServeAlive() to check state, but never start/stop serve processes directly.
 */
export class AgentServeManager {
  private integrations: AgentTelemetryIntegration[] = [];

  constructor(
    private settings: DaemonSettings,
    private telemetryManager: TelemetryManager,
  ) {
    this.integrations = [...getAgentIntegrations()];
  }

  /**
   * Start serve sidecars for all integrations that support them.
   * Called on daemon boot.
   */
  async ensureAllServe(cwd: string): Promise<void> {
    const endpoint = this.settings.telemetryEndpoint;
    if (!endpoint) {
      daemonLog("agent-serve-manager: no telemetry endpoint, skipping serve startup");
      return;
    }

    // Build static OTEL env for serve processes
    const serveEnv: Record<string, string> = {
      OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
      OTEL_EXPORTER_OTLP_PROTOCOL: this.settings.telemetryProtocol,
      OTEL_TRACES_EXPORTER: "otlp",
      OTEL_METRICS_EXPORTER: "otlp",
      OTEL_LOGS_EXPORTER: "otlp",
      OTEL_RESOURCE_ATTRIBUTES: `service.name=${this.settings.telemetryServiceName}`,
    };

    if (this.settings.telemetryAutoInstrumentAgents) {
      serveEnv.OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY = "true";
      serveEnv.CLAUDE_CODE_ENABLE_TELEMETRY = "1";
    }

    for (const integration of this.integrations) {
      if (!integration.ensureServe) continue;

      try {
        daemonLog(`agent-serve-manager: ensuring serve for integration "${integration.id}"`);
        const info = await integration.ensureServe(cwd, serveEnv);
        if (info) {
          daemonLog(`agent-serve-manager: serve started for "${integration.id}", pid=${info.pid}, port=${info.port}`);
        } else {
          daemonLog(`agent-serve-manager: serve not started for "${integration.id}" (not supported or failed)`);
        }
      } catch (err) {
        daemonLog(`agent-serve-manager: failed to start serve for "${integration.id}": ${String(err)}`);
      }
    }
  }

  /**
   * Gracefully shut down all managed serve processes.
   * Called on daemon shutdown.
   */
  async shutdownAll(): Promise<void> {
    for (const integration of this.integrations) {
      if (!integration.shutdownServe) continue;

      try {
        daemonLog(`agent-serve-manager: shutting down serve for "${integration.id}"`);
        await integration.shutdownServe();
      } catch (err) {
        daemonLog(`agent-serve-manager: error shutting down "${integration.id}": ${String(err)}`);
      }
    }
  }
}
