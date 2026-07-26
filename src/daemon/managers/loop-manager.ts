import crypto from "node:crypto";
import { LoopController } from "../../core/loop/loop-controller.js";
import type { LoopOptions, LoopMeta } from "../../types.js";
import type { Project } from "../../types.js";
import { TaskManager } from "./task-manager.js";
import { ProjectManager } from "./project-manager.js";
import {
  saveLoop,
  loadAllLoops,
  deleteLoop as deleteLoopState,
  getLogPath,
} from "../state/index.js";
import { daemonLog } from "../daemon-log.js";
import { type StoredLoop } from "./loop-options.js";
import { createLoopEntry, metaToState } from "./loop-entry.js";
import { wireEvents, persistLoop, buildMeta, buildRecipeMeta } from "./loop-serialization.js";
import { writeRecipeOverrides } from "../recipe/file-writer.js";
import type { RecipeScanner } from "../recipe/scanner.js";
import type { TelemetryManager } from "../telemetry/telemetry-manager.js";

export class LoopManager {
  private loops = new Map<string, StoredLoop>();
  private recipes = new Map<string, StoredLoop>();
  private recipeMeta = new Map<string, { isRecipe: true; recipeFile: string }>();
  private lastSerialized = new Map<string, string>();
  private taskManager: TaskManager;
  private projectManager: ProjectManager;
  private recipeScanner: RecipeScanner | null = null;
  private telemetryManager: TelemetryManager | null = null;

  constructor(taskManager: TaskManager, projectManager?: ProjectManager) {
    this.taskManager = taskManager;
    this.projectManager = projectManager || new ProjectManager();
  }

  setTelemetryManager(mgr: TelemetryManager): void {
    this.telemetryManager = mgr;
  }

  setRecipeScanner(scanner: RecipeScanner): void {
    this.recipeScanner = scanner;
  }

  private taskResolver = (taskId: string) => this.taskManager.get(taskId);

  private getProjectDirectory(projectId: string): string | undefined {
    return this.projectManager.get(projectId)?.directory;
  }

  private persist(id: string, controller: LoopController, options: LoopOptions, intervalHuman: string): void {
    persistLoop(id, controller, options, intervalHuman, this.taskManager, this.lastSerialized);
  }

  private wireUp(id: string, entry: StoredLoop): void {
    wireEvents(id, entry.controller, entry.options, entry.intervalHuman, () =>
      this.persist(id, entry.controller, entry.options, entry.intervalHuman));
  }

  init(): void {
    this.projectManager.init();

    const saved = loadAllLoops();
    let restarted = 0;
    const shouldAutoStart = (s: string) => s !== "idle";
    for (const meta of saved) {
      if (!meta.projectId) {
        meta.projectId = "default";
        saveLoop(meta);
      }

      const entry = createLoopEntry(meta, this.taskResolver, this.getProjectDirectory.bind(this), metaToState(meta), this.telemetryManager ?? undefined);
      this.loops.set(meta.id, entry);
      this.wireUp(meta.id, entry);
      if (shouldAutoStart(meta.status)) {
        entry.controller.start();
        restarted += 1;
      }
    }
    if (restarted > 0) {
      daemonLog(`restarted ${restarted} loop(s) from persisted state`);
    }
  }

  start(options: LoopOptions, intervalHuman: string): string {
    const id = crypto.randomUUID().slice(0, 8);
    const logPath = getLogPath(id);
    const projectDir = this.getProjectDirectory(options.projectId ?? "default");
    const controller = new LoopController(id, options, logPath, this.taskResolver, undefined, projectDir, this.telemetryManager ?? undefined);
    const entry: StoredLoop = { controller, options, intervalHuman };
    this.loops.set(id, entry);
    controller.start();
    this.wireUp(id, entry);
    this.persist(id, controller, options, intervalHuman);
    return id;
  }

  async update(
    id: string,
    options: LoopOptions,
    intervalHuman: string
  ): Promise<boolean> {
    const recipeEntry = this.recipes.get(id);
    if (recipeEntry) {
      return this.updateRecipe(id, options, intervalHuman, recipeEntry);
    }

    const entry = this.loops.get(id);
    if (!entry) return false;

    const executionChanged =
      entry.options.interval !== options.interval ||
      entry.options.taskId !== options.taskId ||
      entry.options.command !== options.command ||
      entry.options.commandArgs.join(" ") !== options.commandArgs.join(" ") ||
      entry.options.immediate !== options.immediate ||
      entry.options.maxRuns !== options.maxRuns ||
      entry.options.verbose !== options.verbose;

    const maxRunsChanged = entry.options.maxRuns !== options.maxRuns;

    Object.assign(entry.options, options);
    entry.intervalHuman = intervalHuman;

    if (maxRunsChanged) {
      entry.controller.clearMaxRunsReached();
    }
    if (entry.controller.status === "running") {
      entry.controller.pause(true);
    } else if (executionChanged && entry.controller.status !== "paused" && entry.controller.status !== "idle") {
      entry.controller.pause();
    }
    this.persist(id, entry.controller, entry.options, entry.intervalHuman);
    return true;
  }

  private updateRecipe(id: string, options: LoopOptions, intervalHuman: string, entry: StoredLoop): boolean {
    if (options.taskId !== entry.options.taskId ||
        options.command !== entry.options.command ||
        options.commandArgs.join(" ") !== entry.options.commandArgs.join(" ") ||
        options.cwd !== entry.options.cwd ||
        options.immediate !== entry.options.immediate ||
        options.verbose !== entry.options.verbose ||
        options.description !== entry.options.description ||
        options.offset !== entry.options.offset ||
        options.projectId !== entry.options.projectId) {
      throw new Error("Recipe loops only allow editing interval, maxRuns, and context");
    }

    const intervalChanged = entry.options.interval !== options.interval;
    const maxRunsChanged = entry.options.maxRuns !== options.maxRuns;
    const contextChanged = JSON.stringify(entry.options.context) !== JSON.stringify(options.context);

    Object.assign(entry.options, options);
    entry.intervalHuman = intervalHuman;

    if (maxRunsChanged) {
      entry.controller.clearMaxRunsReached();
    }

    if (intervalChanged || maxRunsChanged || contextChanged) {
      const recipeInfo = this.recipeMeta.get(id);
      if (recipeInfo && this.recipeScanner) {
        const recipeEntry = this.recipeScanner.getRecipe(id);
        if (recipeEntry) {
          try {
            writeRecipeOverrides(recipeEntry.filePath, {
              intervalHuman,
              maxRuns: options.maxRuns,
              context: options.context,
            });
          } catch (err) {
            daemonLog(`error writing recipe overrides for ${id}: ${String(err)}`);
          }
        }
      }
    }

    if (entry.controller.status === "running" && intervalChanged) {
      entry.controller.pause(true);
    }
    return true;
  }

  list(): LoopMeta[] {
    const result: LoopMeta[] = [];
    for (const [id, entry] of this.loops) {
      result.push(buildMeta(id, entry, this.taskManager));
    }
    for (const [id, entry] of this.recipes) {
      const meta = this.recipeMeta.get(id);
      result.push(buildRecipeMeta(id, entry, this.taskManager, meta?.recipeFile));
    }
    return result;
  }

  listProjects(): Project[] {
    return this.projectManager.getAll();
  }

  createProject(name: string, color: string, directory?: string, githubSource?: string): Project {
    return this.projectManager.create(name, color, directory, githubSource);
  }

  updateProject(id: string, name: string, color?: string, directory?: string, githubSource?: string): void {
    this.projectManager.update(id, name, color, directory, githubSource);
  }

  deleteProject(id: string): void {
    for (const [loopId, entry] of this.loops) {
      if (entry.options.projectId === id) {
        entry.options.projectId = "default";
        this.persist(loopId, entry.controller, entry.options, entry.intervalHuman);
      }
    }

    if (this.recipeScanner) {
      this.recipeScanner.unloadRecipesForProject(id);
    }

    this.projectManager.delete(id);
  }

  status(id: string): LoopMeta | null {
    const userEntry = this.loops.get(id);
    if (userEntry) return buildMeta(id, userEntry, this.taskManager);

    const recipeEntry = this.recipes.get(id);
    if (recipeEntry) {
      const meta = this.recipeMeta.get(id);
      return buildRecipeMeta(id, recipeEntry, this.taskManager, meta?.recipeFile);
    }

    return null;
  }

  pause(id: string): boolean {
    const entry = this.loops.get(id) ?? this.recipes.get(id);
    if (!entry) return false;
    entry.controller.pause();
    if (this.loops.has(id)) {
      this.persist(id, entry.controller, entry.options, entry.intervalHuman);
    }
    return true;
  }

  resume(id: string): boolean {
    const entry = this.loops.get(id) ?? this.recipes.get(id);
    if (!entry) return false;
    entry.controller.resume();
    if (this.loops.has(id)) {
      this.persist(id, entry.controller, entry.options, entry.intervalHuman);
    }
    return true;
  }

  async stopLoop(id: string): Promise<boolean> {
    const entry = this.loops.get(id) ?? this.recipes.get(id);
    if (!entry) return false;
    await entry.controller.stopLoop(true);
    if (this.loops.has(id)) {
      this.persist(id, entry.controller, entry.options, entry.intervalHuman);
    }
    return true;
  }

  async stopAllLoops(): Promise<number> {
    const stops: Promise<void>[] = [];
    for (const [, entry] of this.loops) {
      stops.push(entry.controller.stopLoop(true));
    }
    await Promise.all(stops);
    let count = 0;
    for (const [id, entry] of this.loops) {
      this.persist(id, entry.controller, entry.options, entry.intervalHuman);
      count++;
    }
    for (const [, entry] of this.recipes) {
      entry.controller.stopLoop(true);
      count++;
    }
    return count;
  }

  playLoop(id: string): boolean {
    const entry = this.loops.get(id) ?? this.recipes.get(id);
    if (!entry) return false;
    const ok = entry.controller.playLoop();
    if (ok && this.loops.has(id)) {
      this.persist(id, entry.controller, entry.options, entry.intervalHuman);
    }
    return ok;
  }

  trigger(id: string): boolean {
    const entry = this.loops.get(id) ?? this.recipes.get(id);
    if (!entry) return false;
    const ok = entry.controller.triggerNow();
    if (ok && this.loops.has(id)) {
      this.persist(id, entry.controller, entry.options, entry.intervalHuman);
    }
    return ok;
  }

  isMaxRunsBlocked(id: string): boolean {
    const entry = this.loops.get(id) ?? this.recipes.get(id);
    return !!entry?.controller.isMaxRunsReached();
  }

  isRunning(id: string): boolean {
    const entry = this.loops.get(id) ?? this.recipes.get(id);
    return entry?.controller.status === "running";
  }

  async delete(id: string): Promise<boolean> {
    if (this.recipes.has(id)) {
      throw new Error("Recipe loops cannot be deleted; remove the recipe file instead");
    }

    const entry = this.loops.get(id);
    if (!entry) return false;
    await entry.controller.stop();
    this.loops.delete(id);
    this.lastSerialized.delete(id);
    deleteLoopState(id);
    return true;
  }

  getLogPath(id: string): string | null {
    if (this.loops.has(id) || this.recipes.has(id)) return getLogPath(id);
    return null;
  }

  async shutdown(): Promise<void> {
    const stops: Promise<void>[] = [];
    for (const [, entry] of this.loops) {
      stops.push(entry.controller.stop());
    }
    for (const [, entry] of this.recipes) {
      stops.push(entry.controller.stop());
    }
    await Promise.all(stops);
    this.loops.clear();
    this.recipes.clear();
  }

  reconcile(newLoops: LoopMeta[]): void {
    const newIds = new Set(newLoops.map((l) => l.id));
    const shouldAutoStart = (s: string) => s !== "idle";

    for (const [existingId, entry] of this.loops) {
      if (!newIds.has(existingId)) {
        void entry.controller.stop().then(() => {
          this.loops.delete(existingId);
          this.lastSerialized.delete(existingId);
          deleteLoopState(existingId);
        });
      }
    }

    for (const meta of newLoops) {
      const existing = this.loops.get(meta.id);
      if (existing) {
        const configChanged =
          existing.options.interval !== meta.interval ||
          existing.options.command !== meta.command ||
          existing.options.cwd !== (meta.cwd ?? "");
        if (configChanged) {
          void existing.controller.stop().then(() => {
      const entry = createLoopEntry(meta, this.taskResolver, this.getProjectDirectory.bind(this), metaToState(meta), this.telemetryManager ?? undefined);
            this.loops.set(meta.id, entry);
            this.wireUp(meta.id, entry);
            if (shouldAutoStart(meta.status)) {
              entry.controller.start();
            }
          });
        }
      } else {
        const entry = createLoopEntry(meta, this.taskResolver, this.getProjectDirectory.bind(this), metaToState(meta), this.telemetryManager ?? undefined);
        this.loops.set(meta.id, entry);
        this.wireUp(meta.id, entry);
        if (shouldAutoStart(meta.status)) {
          entry.controller.start();
        }
      }
    }
  }

  addRecipeLoop(id: string, entry: StoredLoop, recipeFile: string, persist: () => void): void {
    this.recipes.set(id, entry);
    this.recipeMeta.set(id, { isRecipe: true, recipeFile });
    wireEvents(id, entry.controller, entry.options, entry.intervalHuman, persist);
  }

  removeRecipeLoop(id: string): void {
    const entry = this.recipes.get(id);
    if (entry) {
      entry.controller.stopLoop(true);
      this.recipes.delete(id);
      this.recipeMeta.delete(id);
    }
  }

  isRecipeLoop(id: string): boolean {
    return this.recipes.has(id);
  }
}
