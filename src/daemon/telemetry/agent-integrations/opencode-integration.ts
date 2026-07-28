import type { AgentTelemetryIntegration } from "./agent-integration.js";
import type {
  CommandInvocation,
  PreparedCommandInvocation,
  ChildTelemetryContext,
  AgentUsage,
  CommandResult,
  ServeInfo,
} from "../telemetry-types.js";
import { execa } from "execa";
import { daemonLog } from "../../daemon-log.js";

const OPENCODE_BINARIES = ["opencode"];
const SERVE_PORT = 4096;
const SERVE_URL = `http://localhost:${SERVE_PORT}`;
const HEALTH_CHECK_TIMEOUT_MS = 120_000;
const HEALTH_CHECK_INTERVAL_MS = 1_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

/**
 * Detects `opencode run ...` invocations and enables OpenCode's
 * native OpenTelemetry support, routing to loop-task's endpoint.
 *
 * Also manages a persistent `opencode serve` sidecar process so that
 * `opencode run` tasks delegate to a warm serve instance via `--attach`,
 * eliminating per-task cold-start time.
 */
export class OpenCodeTelemetryIntegration implements AgentTelemetryIntegration {
  readonly id = "opencode";

  private serveProcess: ReturnType<typeof execa> | null = null;
  private serveInfo: ServeInfo | null = null;

  matches(command: string, args: string[]): boolean {
    const basename = command.split("/").pop()?.replace(/\.exe$/, "").toLowerCase() ?? "";
    return OPENCODE_BINARIES.includes(basename) && args[0] === "run";
  }

  prepare(
    invocation: CommandInvocation,
    _context: ChildTelemetryContext,
  ): PreparedCommandInvocation {
    const env: Record<string, string> = { ...invocation.env };

    // Enable OpenCode's experimental OpenTelemetry
    env.OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY = "true";

    return { command: invocation.command, args: [...invocation.args], env };
  }

  async ensureServe(cwd: string, env: Record<string, string>): Promise<ServeInfo | void> {
    // Already running and healthy
    if (this.serveInfo && this.isServeAlive()) {
      return this.serveInfo;
    }

    try {
      daemonLog("opencode-serve: starting opencode serve sidecar");
      this.serveProcess = execa("opencode", [
        "serve",
        "--port", String(SERVE_PORT),
        "--hostname", "127.0.0.1",
      ], {
        cwd,
        env: { ...process.env, ...env },
        stdout: "pipe",
        stderr: "pipe",
        buffer: false,
        detached: false,
      });

      this.serveProcess.catch((err) => {
        daemonLog(`opencode-serve: process error: ${String(err)}`);
        this.serveProcess = null;
        this.serveInfo = null;
      });

      this.serveProcess.on("exit", (code) => {
        daemonLog(`opencode-serve: process exited with code ${code}`);
        this.serveProcess = null;
        this.serveInfo = null;
      });

      // Wait for health check
      const healthy = await this.waitForHealth();
      if (healthy) {
        const pid = this.serveProcess?.pid;
        if (pid) {
          this.serveInfo = { port: SERVE_PORT, pid, url: SERVE_URL };
          daemonLog(`opencode-serve: healthy, pid=${pid}, port=${SERVE_PORT}`);
          return this.serveInfo;
        }
      }

      daemonLog("opencode-serve: health check timed out");
      return;
    } catch (err) {
      daemonLog(`opencode-serve: failed to start: ${String(err)}`);
      this.serveProcess = null;
      this.serveInfo = null;
      return;
    }
  }

  isServeAlive(): boolean {
    // Fast check: if we don't have a process reference, serve is not alive
    if (!this.serveProcess || !this.serveInfo) return false;
    return true;
  }

  prepareRunArgs(args: string[], cwd?: string): string[] {
    const modified: string[] = [...args];

    // Inject --attach after "run" (args[0] === "run")
    const runIndex = modified.indexOf("run");
    if (runIndex === -1) return modified;

    // Check if --attach is already present
    const hasAttach = modified.includes("--attach");
    if (!hasAttach) {
      modified.splice(runIndex + 1, 0, "--attach", SERVE_URL);
    }

    // Inject --dir so serve knows which directory to work in
    const hasDir = modified.includes("--dir");
    if (!hasDir && cwd) {
      // Find the position after --attach (or after "run" if --attach wasn't added by us)
      const attachIdx = modified.indexOf("--attach");
      const insertPos = attachIdx >= 0 ? attachIdx + 2 : runIndex + 1;
      modified.splice(insertPos, 0, "--dir", cwd);
    }

    return modified;
  }

  async shutdownServe(): Promise<void> {
    if (!this.serveProcess) return;

    daemonLog("opencode-serve: shutting down serve process");
    const proc = this.serveProcess;
    this.serveProcess = null;
    this.serveInfo = null;

    try {
      proc.kill("SIGTERM");
      await Promise.race([
        proc,
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("shutdown timeout")), SHUTDOWN_TIMEOUT_MS),
        ),
      ]);
    } catch {
      // Force kill if SIGTERM didn't work
      try {
        proc.kill("SIGKILL");
      } catch {
        // best effort
      }
    }
  }

  private async waitForHealth(): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < HEALTH_CHECK_TIMEOUT_MS) {
      if (!this.serveProcess) return false; // process exited

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3_000);
        const res = await fetch(`${SERVE_URL}/global/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          const data = await res.json() as { healthy?: boolean };
          if (data.healthy === true) return true;
        }
      } catch {
        // server not ready yet
      }

      await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL_MS));
    }
    return false;
  }
}
