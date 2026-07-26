import { LoopController } from "../../core/loop/loop-controller.js";
import type { LoopOptions, LoopMeta } from "../../types.js";
import { saveLoop } from "../state/index.js";
import type { TaskManager } from "./task-manager.js";
import type { StoredLoop } from "./loop-options.js";

export function wireEvents(
  id: string,
  controller: LoopController,
  options: LoopOptions,
  intervalHuman: string,
  persist: () => void,
): void {
  controller.on("run:start", persist);
  controller.on("run:end", persist);
  controller.on("paused", persist);
  controller.on("resumed", persist);
  controller.on("triggered", persist);
  controller.on("waiting", persist);
  controller.on("stopped", persist);
}

export function toMeta(
  controller: LoopController,
  options: LoopOptions,
  intervalHuman: string,
  taskManager: TaskManager,
): LoopMeta {
  const runtime = controller.getMeta();
  const task = options.taskId ? taskManager.get(options.taskId) : null;
  return {
    ...runtime,
    command: task?.command ?? options.command,
    commandArgs: task?.commandArgs ?? options.commandArgs,
    commandRaw: options.commandRaw,
    cwd: options.cwd || "",
    interval: options.interval,
    intervalHuman,
    immediate: options.immediate,
    maxRuns: options.maxRuns,
    verbose: options.verbose,
    description: options.description,
    remainingDelayMs: runtime.remainingDelayMs,
    pid: process.pid,
    projectId: options.projectId ?? "default",
    offset: options.offset,
    context: options.context,
  };
}

export function persistLoop(
  id: string,
  controller: LoopController,
  options: LoopOptions,
  intervalHuman: string,
  taskManager: TaskManager,
  lastSerialized: Map<string, string>,
): void {
  const meta = toMeta(controller, options, intervalHuman, taskManager);
  const serialized = JSON.stringify(meta);
  if (lastSerialized.get(id) === serialized) {
    return;
  }
  lastSerialized.set(id, serialized);
  saveLoop(meta);
}

export function buildMeta(
  id: string,
  entry: StoredLoop,
  taskManager: TaskManager,
): LoopMeta {
  return toMeta(entry.controller, entry.options, entry.intervalHuman, taskManager);
}

export function buildRecipeMeta(
  id: string,
  entry: StoredLoop,
  taskManager: TaskManager,
  recipeFile?: string,
  recipeFilePath?: string,
): LoopMeta {
  const base = toMeta(entry.controller, entry.options, entry.intervalHuman, taskManager);
  return {
    ...base,
    isRecipe: true,
    recipeFile: recipeFile ?? "",
    recipeFilePath: recipeFilePath ?? "",
  };
}
