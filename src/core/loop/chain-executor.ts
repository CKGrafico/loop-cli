import crypto from "node:crypto";
import fs from "node:fs";
import { Writable } from "node:stream";
import type { ExecutionResult, TaskCommand, TaskDefinition, TaskStep } from "../../types.js";
import { DEFAULT_TASK_MAX_RUNS } from "../../types.js";
import { executeCommand } from "../command/command-runner.js";
import { t } from "../../shared/i18n/index.js";
import { parseStdout } from "../context/context-parser.js";
import { interpolate } from "../context/template.js";
import type { LoopController } from "./loop-controller.js";
import type { TelemetryManager } from "../../daemon/telemetry/telemetry-manager.js";
import type { TelemetrySpan } from "../../daemon/telemetry/index.js";

export interface ChainExecuteOptions {
  chainTargetId: string | undefined;
  exitCode: number;
  task: TaskDefinition | null;
  chainContext: Record<string, unknown>;
  cwd: string;
  signal: AbortSignal;
  runCount: number;
  logPath: string;
  runHistory: import("../../types.js").RunRecord[];
  logStream: Writable | null;
  controller: LoopController;
  telemetryManager?: TelemetryManager | null;
  loopId?: string;
  loopName?: string;
  runId?: string;
  loopSpan?: TelemetrySpan;
}

export interface ChainExecuteResult {
  runHistory: import("../../types.js").RunRecord[];
  lastExitCode: number;
  lastDuration: number;
}

export function executeChain(options: ChainExecuteOptions): Promise<ChainExecuteResult> {
  const { chainTargetId, exitCode, task: _task, chainContext, cwd, signal, runCount, logPath, runHistory, logStream, controller, telemetryManager, loopId, loopName, runId, loopSpan } = options;

  const nullStream = new Writable({ write(_chunk, _enc, cb) { cb(); } });

  if (!chainTargetId) {
    return Promise.resolve({ runHistory, lastExitCode: exitCode, lastDuration: 0 });
  }

  const chainGroupId = crypto.randomUUID().slice(0, 8);
  const mainRecord = runHistory[runHistory.length - 1];
  if (mainRecord) mainRecord.chainGroupId = chainGroupId;

  let currentTargetId: string | null = chainTargetId;
  let prevBranch = exitCode === 0 ? "onSuccess" : "onFailure";
  let prevExit = exitCode;
  let totalExtraDuration = 0;
  let finalExitCode = exitCode;
  let hadSilentChain = false;

  return (async () => {
    while (currentTargetId) {
      if (signal.aborted) break;
      const chainTask = controller.taskResolver(currentTargetId);
      if (!chainTask) break;

      // Per-task maxRuns check for chained tasks
      const chainTaskMaxRuns = chainTask.maxRuns ?? DEFAULT_TASK_MAX_RUNS;
      const chainTaskRunCount = controller.getTaskRunCount(chainTask.id);
      if (chainTaskRunCount >= chainTaskMaxRuns) {
        // Chained task exceeded its max runs limit — fail it and continue chain
        const chainRecord = runHistory.find(r => r.chainGroupId === chainGroupId && r.status === "running" && r.chainName === chainTask.name);
        if (chainRecord) {
          chainRecord.exitCode = 1;
          chainRecord.duration = 0;
          chainRecord.logSize = 0;
          chainRecord.status = "completed";
        }
        totalExtraDuration += 0;
        finalExitCode = 1;
        currentTargetId = chainTask.onFailureTaskId ?? null;
        prevBranch = "onFailure";
        prevExit = 1;
        continue;
      }

      const isSilent = chainTask.silentChain === true;
      if (isSilent) {
        controller.incrementSilentChainCount();
        hadSilentChain = true;
      }

      if (logStream && !isSilent) {
        logStream.write(t("loop.chainHeader", { name: chainTask.name, branch: prevBranch, prevExit }));
      }

      const chainStartedAt = new Date().toISOString();
      const chainOffset = !isSilent && fs.existsSync(logPath) ? fs.statSync(logPath).size : 0;
      if (!isSilent) {
        runHistory.push({
          runNumber: runCount,
          startedAt: chainStartedAt,
          exitCode: -1,
          duration: 0,
          logSize: 0,
          status: "running",
          logOffset: chainOffset,
          chainGroupId,
          chainName: chainTask.name,
        });
      }

      const singleCommandFallback: TaskCommand = {
        command: chainTask.command,
        commandArgs: chainTask.commandArgs,
        commandRaw: chainTask.commandRaw,
      };
      const taskSteps: TaskStep[] = chainTask.steps?.length
        ? chainTask.steps
        : [{ commands: [singleCommandFallback] }];

      const chainTaskHasChains = !!(chainTask.onSuccessTaskId || chainTask.onFailureTaskId);
      const shouldCaptureStdout = chainTaskHasChains || taskSteps.length > 1 || taskSteps[0]!.commands.length > 1;

      let chainExitCode = 0;
      let chainDuration = 0;

      const effectiveStream: Writable = isSilent ? nullStream : (logStream ?? nullStream);

      // Telemetry: create task span for chained task
      const telemetry = telemetryManager?.getAdapter();
      const chainTaskSpan = (telemetry && chainTask)
        ? telemetry.startTask(
          {
            taskId: chainTask.id,
            taskName: chainTask.name,
            runId: runId ?? `chain-${chainGroupId}`,
            loopId: loopId ?? "chain",
            loopName: loopName ?? "chain",
          },
          loopSpan,
        )
        : undefined;

      const chainTelemetryCtx = telemetry
        ? {
          telemetry,
          loopSpan,
          taskSpan: chainTaskSpan,
          runId: runId ?? `chain-${chainGroupId}`,
          loopId: loopId ?? "chain",
          loopName: loopName ?? "chain",
          taskId: chainTask.id,
          taskName: chainTask.name,
          telemetryConfig: chainTask.telemetry,
        }
        : undefined;

      for (const step of taskSteps) {
        if (signal.aborted) break;
        const stepResults = await Promise.allSettled(
          step.commands.map((cmd) =>
            executeCommand(
              interpolate(cmd.command, chainContext),
              cmd.commandArgs.map(a => interpolate(a, chainContext)),
              cwd,
              effectiveStream,
              signal,
              runCount,
              shouldCaptureStdout,
              false,
              chainTelemetryCtx,
            )
          )
        );

        if (signal.aborted) break;

        let stepStdout = "";
        for (const r of stepResults) {
          if (r.status === "fulfilled") {
            chainDuration += r.value.duration;
            if (r.value.stdout) stepStdout += (stepStdout ? "\n" : "") + r.value.stdout;
          }
        }

        if (shouldCaptureStdout && stepStdout) {
          const parsed = parseStdout(stepStdout);
          if (parsed !== null) {
            Object.assign(chainContext, parsed);
          }
        }

        const stepFailure = stepResults.some(
          (r) => r.status === "rejected" || (r.status === "fulfilled" && r.value.exitCode !== 0)
        );
        if (stepFailure) {
          const failed = stepResults.find(
            (r): r is PromiseFulfilledResult<ExecutionResult> =>
              r.status === "fulfilled" && r.value.exitCode !== 0
          );
          chainExitCode = failed ? failed.value.exitCode : 1;
          break;
        }
      }

      const chainLogSize = !isSilent && fs.existsSync(logPath) ? fs.statSync(logPath).size - chainOffset : 0;
      const chainRecord = runHistory.find(r => r.chainGroupId === chainGroupId && r.status === "running" && r.chainName === chainTask.name);
      if (chainRecord) {
        chainRecord.exitCode = chainExitCode;
        chainRecord.duration = chainDuration;
        chainRecord.logSize = Math.max(0, chainLogSize);
        chainRecord.status = "completed";
      }

      totalExtraDuration += chainDuration;
      finalExitCode = chainExitCode;

      // End the chain task span
      if (chainTaskSpan) {
        chainTaskSpan.end(chainExitCode === 0 ? "ok" : "error");
      }

      // Increment per-task run counter for the chained task
      controller.incrementTaskRunCount(chainTask.id);

      currentTargetId = (chainExitCode === 0 ? chainTask.onSuccessTaskId : chainTask.onFailureTaskId) ?? null;
      prevBranch = chainExitCode === 0 ? "onSuccess" : "onFailure";
      prevExit = chainExitCode;
    }

    // If any silent chain task ran, remove all records for this chain group
    // (including the main task record) — the run was uninteresting.
    if (hadSilentChain) {
      const filtered = runHistory.filter(r => r.chainGroupId !== chainGroupId);
      runHistory.length = 0;
      runHistory.push(...filtered);
    }

    return { runHistory, lastExitCode: finalExitCode, lastDuration: totalExtraDuration };
  })();
}
