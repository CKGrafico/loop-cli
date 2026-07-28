import fs from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import { execa, type ResultPromise } from "execa";
import type { ExecutionResult } from "../../types.js";
import { Logger } from "../../logger.js";
import { formatDuration } from "../../duration.js";
import { t } from "../../shared/i18n/index.js";
import { MAX_CONTEXT_STDOUT_BYTES, MAX_SPAN_OUTPUT_BYTES } from "../../shared/config/constants.js";
import { StdoutCaptureTransform } from "./stdout-capture-transform.js";
import { killProcessTree } from "./process-tree.js";
import type { Telemetry, TelemetrySpan } from "../../daemon/telemetry/index.js";
import type { CommandResult } from "../../daemon/telemetry/telemetry-types.js";
import { getAgentIntegrations } from "../../daemon/telemetry/agent-integrations/index.js";
import { getDataDir } from "../../shared/config/paths.js";
import { parseOpencodeJsonOutput } from "../context/opencode-json-parser.js";
import type { OpencodeContext } from "../context/types.js";

function quoteArg(arg: string): string {
  if (arg.length === 0) return "''";
  if (/^[A-Za-z0-9_\-=:./,@]+$/.test(arg)) return arg;
  const cleaned = arg.replace(/[\n\r]/g, " ");
  return "'" + cleaned.replace(/'/g, "'\\''") + "'";
}

function formatCommandLine(command: string, commandArgs: string[]): string {
  return [command, ...commandArgs.map(quoteArg)].join(" ").trim();
}

export function extractExitCode(error: unknown): number {
  return error && typeof error === "object" && "exitCode" in error
    ? (error as { exitCode: number }).exitCode
    : 1;
}

export interface WritableLogStream {
  write(chunk: string | Buffer, cb?: (err?: Error | null) => void): boolean;
  end(cb?: () => void): unknown;
}

export function childEnv(): NodeJS.ProcessEnv {
  if (process.env.LOOP_TASK_DEFAULTED_NODE_ENV !== "1") {
    return process.env;
  }
  return {
    ...process.env,
    NODE_ENV: undefined,
    LOOP_TASK_DEFAULTED_NODE_ENV: undefined,
  };
}

function loadEnvFile(): Record<string, string> {
  try {
    const envPath = path.join(getDataDir(), "env");
    const content = fs.readFileSync(envPath, "utf-8");
    const env: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (key) env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

const activePids = new Set<number>();

export function getActivePids(): ReadonlySet<number> {
  return activePids;
}

export function killAllActiveProcesses(): void {
  for (const pid of activePids) {
    killProcessTree(pid, "SIGTERM").catch(() => {});
  }
}

export interface TelemetryCommandContext {
  telemetry: Telemetry;
  loopSpan?: TelemetrySpan;
  taskSpan?: TelemetrySpan;
  runId: string;
  loopId: string;
  loopName: string;
  taskId?: string;
  taskName?: string;
  projectId?: string;
  projectName?: string;
  /** Per-task telemetry override from TaskDefinition */
  telemetryConfig?: import("../../types.js").TaskTelemetryConfig;
  chainContext?: Record<string, unknown>;
}

export async function executeCommand(
  command: string,
  commandArgs: string[],
  cwd: string,
  logStream: Writable,
  signal?: AbortSignal,
  runNumber?: number,
  captureStdout: boolean = false,
  isChain: boolean = false,
  telemetryCtx?: TelemetryCommandContext,
): Promise<ExecutionResult> {
  let effectiveCommand = command;
  let effectiveArgs = commandArgs;

  const startedAt = new Date();
  if (!isChain) {
    const header = t("loop.runHeader", { timestamp: startedAt.toLocaleString(), runNumber: runNumber ?? 0 });
    logStream.write(header);
  }
  if (cwd) {
    logStream.write(t("loop.cwdLine", { cwd }));
  }

  if (cwd && !fs.existsSync(cwd)) {
    const endedAt = new Date();
    logStream.write(t("loop.cwdMissingLog", { cwd }));
    logStream.write(t("loop.exitMarker", { code: 1, duration: formatDuration(0) }));
    return { exitCode: 1, duration: 0, startedAt, endedAt };
  }

  // Per-task telemetry override: skip telemetry for this command entirely
  const taskTelemetryDisabled = telemetryCtx?.telemetryConfig?.enabled === false;

  // Telemetry: create command span and prepare child env
  const commandSpan = (telemetryCtx && !taskTelemetryDisabled)
    ? telemetryCtx.telemetry.startCommand(
      {
        command,
        commandLine: formatCommandLine(command, commandArgs),
        argumentCount: commandArgs.length,
        cwd,
        runId: telemetryCtx.runId,
        loopId: telemetryCtx.loopId,
        taskId: telemetryCtx.taskId,
        taskName: telemetryCtx.taskName,
      },
      telemetryCtx.taskSpan ?? telemetryCtx.loopSpan,
    )
    : undefined;

  let telemetryEnv: Record<string, string> = {};
  let detectedIntegrationId: string | undefined;

  if (telemetryCtx && telemetryCtx.telemetry.getStatus().enabled && !taskTelemetryDisabled) {
    const traceCtx = (telemetryCtx.taskSpan ?? telemetryCtx.loopSpan)?.getTraceContext() ?? {};
    const integrationOverride = telemetryCtx.telemetryConfig?.integration;
    const prepared = telemetryCtx.telemetry.prepareChildProcess(
      { command, args: commandArgs, cwd },
      {
        runId: telemetryCtx.runId,
        loopId: telemetryCtx.loopId,
        loopName: telemetryCtx.loopName,
        taskId: telemetryCtx.taskId,
        taskName: telemetryCtx.taskName,
        projectId: telemetryCtx.projectId,
        projectName: telemetryCtx.projectName,
        traceParent: traceCtx.traceParent,
        traceState: traceCtx.traceState,
      },
      integrationOverride,
    );
    telemetryEnv = prepared.env;
    detectedIntegrationId = prepared.integrationId;
    if (detectedIntegrationId && commandSpan) {
      commandSpan.setAttribute("loop_task.agent.integration", detectedIntegrationId);
    }
  }

  if (detectedIntegrationId) {
    const allIntegrations = getAgentIntegrations();
    const integration = allIntegrations.find((i) => i.id === detectedIntegrationId);
    if (integration?.ensureServe && integration?.isServeAlive && integration?.prepareRunArgs) {
      try {
        const serveEnv: Record<string, string> = {};
        if (telemetryEnv.OTEL_EXPORTER_OTLP_ENDPOINT) {
          serveEnv.OTEL_EXPORTER_OTLP_ENDPOINT = telemetryEnv.OTEL_EXPORTER_OTLP_ENDPOINT;
          serveEnv.OTEL_EXPORTER_OTLP_PROTOCOL = telemetryEnv.OTEL_EXPORTER_OTLP_PROTOCOL ?? "http/protobuf";
          serveEnv.OTEL_TRACES_EXPORTER = "otlp";
          serveEnv.OTEL_METRICS_EXPORTER = "otlp";
          serveEnv.OTEL_LOGS_EXPORTER = "otlp";
          if (telemetryEnv.OTEL_RESOURCE_ATTRIBUTES) {
            serveEnv.OTEL_RESOURCE_ATTRIBUTES = telemetryEnv.OTEL_RESOURCE_ATTRIBUTES;
          }
          if (telemetryEnv.OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY) {
            serveEnv.OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY = telemetryEnv.OPENCODE_EXPERIMENTAL_OPEN_TELEMETRY;
          }
        }
        await integration.ensureServe(cwd || process.cwd(), serveEnv);

        if (integration.isServeAlive()) {
          effectiveArgs = integration.prepareRunArgs(commandArgs, cwd || undefined);
          if (commandSpan) {
            commandSpan.setAttribute("loop_task.agent.serve_attached", true);
          }
        }
      } catch (err) {
        // Serve failure is non-fatal — fall back to cold start
        if (commandSpan) {
          commandSpan.setAttribute("loop_task.agent.serve_error", String(err));
        }
      }
    }
  }

  if (detectedIntegrationId === "opencode" && effectiveArgs[0] === "run") {
    if (!effectiveArgs.includes("--format") && !effectiveArgs.includes("-f")) {
      effectiveArgs = [...effectiveArgs.slice(0, 1), "--format", "json", ...effectiveArgs.slice(1)];
    }
    if (!effectiveArgs.includes("--session") && !effectiveArgs.includes("-s")) {
      const opencodeCtx = telemetryCtx?.chainContext?.opencode as Record<string, unknown> | undefined;
      const sessionId = (opencodeCtx?.session as Record<string, unknown> | undefined)?.id as string | undefined;
      if (sessionId) {
        effectiveArgs = [...effectiveArgs.slice(0, 1), "--session", sessionId, ...effectiveArgs.slice(1)];
        if (!effectiveArgs.includes("--model") && !effectiveArgs.includes("-m")) {
          const model = (opencodeCtx as Record<string, unknown>)?.model as string | undefined;
          if (model) {
            effectiveArgs = [...effectiveArgs.slice(0, 1), "--model", model, ...effectiveArgs.slice(1)];
          }
        }
      }
    }
  }

  logStream.write(t("loop.commandLine", { command: formatCommandLine(effectiveCommand, effectiveArgs) }));

  const shellCommand = formatCommandLine(effectiveCommand, effectiveArgs);
  const needShell = /(\$\(|`|&&|\|\||;|>|<|\|)/.test(shellCommand);

  const baseEnv = childEnv();
  const fileEnv = loadEnvFile();
  const mergedEnv: Record<string, string> = {
    ...(baseEnv as Record<string, string>),
    ...fileEnv,
    ...telemetryEnv,
  };

  const detachedOpt = process.platform !== "win32" ? { detached: true as const } : {};
  const child: ResultPromise = needShell
    ? execa(shellCommand, {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      buffer: false,
      cwd: cwd || undefined,
      cancelSignal: signal,
      shell: true,
      env: mergedEnv,
      killSignal: "SIGTERM",
      ...detachedOpt,
    })
    : execa(command, commandArgs, {
      stdout: "pipe",
      stderr: "pipe",
      stdin: "ignore",
      buffer: false,
      cwd: cwd || undefined,
      cancelSignal: signal,
      env: mergedEnv,
      killSignal: "SIGTERM",
      ...detachedOpt,
    });

  if (child.pid) {
    activePids.add(child.pid);
  }

  const stdoutCapture = (captureStdout || !!detectedIntegrationId)
    ? new StdoutCaptureTransform(MAX_CONTEXT_STDOUT_BYTES)
    : null;
  const stderrCapture = (captureStdout || !!detectedIntegrationId)
    ? new StdoutCaptureTransform(MAX_CONTEXT_STDOUT_BYTES)
    : null;

  if (stdoutCapture) {
    child.stdout!.pipe(stdoutCapture).pipe(logStream, { end: false });
  } else {
    child.stdout!.pipe(logStream, { end: false });
  }
  if (stderrCapture) {
    child.stderr!.pipe(stderrCapture).pipe(logStream, { end: false });
  } else {
    child.stderr!.pipe(logStream, { end: false });
  }

  try {
    const result = await child;
    const endedAt = new Date();
    const duration = endedAt.getTime() - startedAt.getTime();
    if (child.pid) activePids.delete(child.pid);
    if (stdoutCapture?.isTruncated()) {
      logStream.write(t("context.truncationWarning"));
    }
    logStream.write(t("loop.exitMarker", { code: String(result.exitCode), duration: formatDuration(duration) }));

    if (commandSpan) {
      commandSpan.setAttribute("process.exit.code", result.exitCode ?? 0);
      if (telemetryCtx?.telemetry.getStatus().captureCommandOutput && stdoutCapture) {
        commandSpan.setAttribute("loop_task.command.stdout", truncateForSpan(stdoutCapture.getCaptured(), MAX_SPAN_OUTPUT_BYTES));
      }
    }

    if (detectedIntegrationId && stdoutCapture) {
      tryParseAgentUsage(
        telemetryCtx!.telemetry,
        detectedIntegrationId,
        { exitCode: result.exitCode ?? 0, stdout: stdoutCapture.getCaptured(), duration },
        commandSpan,
      );
    }

    if (detectedIntegrationId === "opencode" && stdoutCapture) {
      const opencodeCtx = parseOpencodeJsonOutput(stdoutCapture.getCaptured());
      if (opencodeCtx) {
        const modelIdx = effectiveArgs.indexOf("--model");
        const modelShortIdx = effectiveArgs.indexOf("-m");
        const modelIdxToUse = modelIdx >= 0 ? modelIdx : modelShortIdx;
        if (modelIdxToUse >= 0 && modelIdxToUse + 1 < effectiveArgs.length) {
          opencodeCtx.model = effectiveArgs[modelIdxToUse + 1];
        }
        if (commandSpan) {
          commandSpan.setAttribute("loop_task.opencode.session_id", opencodeCtx.session.id);
          commandSpan.setAttribute("loop_task.opencode.cost", opencodeCtx.cost);
          commandSpan.setAttribute("loop_task.opencode.tools_count", opencodeCtx.tools.count);
          if (opencodeCtx.error) {
            commandSpan.setAttribute("loop_task.opencode.error", opencodeCtx.error.name);
          }
        }
        // The parsed context is returned as part of the result so context-parser
        (result as unknown as Record<string, unknown>).opencode = opencodeCtx;
      }
    }

    if (commandSpan) {
      commandSpan.ok();
    }

    return {
      exitCode: result.exitCode ?? 0,
      duration,
      startedAt,
      endedAt,
      ...(captureStdout && stdoutCapture ? { stdout: stdoutCapture.getCaptured() } : {}),
      ...(captureStdout && stderrCapture ? { stderr: stderrCapture.getCaptured() } : {}),
    };
  } catch (error: unknown) {
    const endedAt = new Date();
    const duration = endedAt.getTime() - startedAt.getTime();
    const exitCode = extractExitCode(error);
    if (child.pid) {
      activePids.delete(child.pid);
      if (signal?.aborted) {
        await killProcessTree(child.pid);
      }
    }
    if (stdoutCapture?.isTruncated()) {
      logStream.write(t("context.truncationWarning"));
    }
    logStream.write(t("loop.exitMarker", { code: exitCode, duration: formatDuration(duration) }));

    if (commandSpan) {
      commandSpan.setAttribute("process.exit.code", exitCode);
      if (telemetryCtx?.telemetry.getStatus().captureCommandOutput && stdoutCapture) {
        commandSpan.setAttribute("loop_task.command.stdout", truncateForSpan(stdoutCapture.getCaptured(), MAX_SPAN_OUTPUT_BYTES));
      }
      commandSpan.end(signal?.aborted ? "cancelled" : "error");
    }

    // Attempt to parse agent usage from output even on failure
    if (detectedIntegrationId && stdoutCapture) {
      tryParseAgentUsage(
        telemetryCtx!.telemetry,
        detectedIntegrationId,
        { exitCode, stdout: stdoutCapture.getCaptured(), duration },
        commandSpan,
      );
    }

    return {
      exitCode,
      duration,
      startedAt,
      endedAt,
      ...(captureStdout && stdoutCapture ? { stdout: stdoutCapture.getCaptured() } : {}),
      ...(captureStdout && stderrCapture ? { stderr: stderrCapture.getCaptured() } : {}),
    };
  }
}

export async function executeCommandForeground(
  command: string,
  commandArgs: string[],
  logger: Logger,
  cwd = ""
): Promise<ExecutionResult> {
  const startedAt = new Date();
  logger.debug(t("loop.executing", { command: `${command} ${commandArgs.join(" ")}` }));

  if (cwd && !fs.existsSync(cwd)) {
    logger.error(t("loop.cwdMissing", { cwd }));
    const endedAt = new Date();
    return { exitCode: 1, duration: 0, startedAt, endedAt };
  }

  try {
    const result = await execa(command, commandArgs, {
      stdout: "inherit",
      stderr: "inherit",
      stdin: "inherit",
      cwd: cwd || undefined,
      shell: true,
      env: childEnv(),
    });

    const endedAt = new Date();
    return {
      exitCode: result.exitCode ?? 0,
      duration: endedAt.getTime() - startedAt.getTime(),
      startedAt,
      endedAt,
    };
  } catch (error: unknown) {
    const endedAt = new Date();
    return {
      exitCode: extractExitCode(error),
      duration: endedAt.getTime() - startedAt.getTime(),
      startedAt,
      endedAt,
    };
  }
}

function tryParseAgentUsage(
  telemetry: Telemetry,
  integrationId: string,
  result: CommandResult,
  span?: TelemetrySpan,
): void {
  try {
    const integrations = getAgentIntegrations();
    const match = integrations.find((i) => i.id === integrationId);
    if (!match?.parseUsage) return;
    const usage = match.parseUsage(result);
    if (usage) {
      usage.integration = integrationId;
      telemetry.recordAgentUsage(usage, span);
    }
  } catch {
    // Telemetry must never fail execution
  }
}

function truncateForSpan(text: string, maxBytes: number): string {
  const buf = Buffer.from(text, "utf-8");
  if (buf.length <= maxBytes) return text;
  return buf.subarray(0, maxBytes).toString("utf-8") + `\n... [truncated, ${buf.length} bytes total]`;
}
