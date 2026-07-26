import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loopsJson, tasksJson, projectsJson } from "../../shared/config/paths.js";
import type { LoopMeta, TaskDefinition, Project } from "../../types.js";

import type { LoopManager } from "../managers/loop-manager.js";
import type { TaskManager } from "../managers/task-manager.js";
import type { ProjectManager } from "../managers/project-manager.js";
import type { RecipeScanner } from "../recipe/scanner.js";
import type { DeferredReloadManager } from "../recipe/deferred-reload.js";

const DEBOUNCE_MS = 300;
const MTIME_POLL_MS = 2000;

interface WatcherEntry {
  lastHash: string;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  lastMtime: number;
}

interface DirWatcherEntry {
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

export class FileWatcher {
  private watchers = new Map<string, WatcherEntry>();
  private mtimeTimers = new Map<string, ReturnType<typeof setInterval>>();
  private dirWatchers = new Map<string, DirWatcherEntry>();
  private loopManager: LoopManager | null = null;
  private taskManager: TaskManager | null = null;
  private projectManager: ProjectManager | null = null;
  private recipeScanner: RecipeScanner | null = null;
  private deferredReload: DeferredReloadManager | null = null;

  setManagers(loopManager: LoopManager, taskManager: TaskManager, projectManager: ProjectManager): void {
    this.loopManager = loopManager;
    this.taskManager = taskManager;
    this.projectManager = projectManager;
  }

  setRecipeScanner(scanner: RecipeScanner, deferredReload: DeferredReloadManager): void {
    this.recipeScanner = scanner;
    this.deferredReload = deferredReload;
  }

  start(): void {
    this.watch(loopsJson(), (content) => this.handleLoopsChange(content));
    this.watch(tasksJson(), (content) => this.handleTasksChange(content));
    this.watch(projectsJson(), (content) => this.handleProjectsChange(content));
  }

  stop(): void {
    for (const [, entry] of this.watchers) {
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer);
    }
    for (const [, timer] of this.mtimeTimers) {
      clearInterval(timer);
    }
    this.watchers.clear();
    this.mtimeTimers.clear();
  }

  registerSelfWrite(filePath: string, content: string): void {
    const hash = this.hash(content);
    const entry = this.watchers.get(filePath);
    if (entry) {
      entry.lastHash = hash;
    }
  }

  private watch(filePath: string, onChange: (content: string) => void): void {
    const dir = path.dirname(filePath);
    const basename = path.basename(filePath);

    this.watchers.set(filePath, {
      lastHash: "",
      debounceTimer: null,
      lastMtime: 0,
    });

    try {
      const initialContent = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
      this.watchers.get(filePath)!.lastHash = this.hash(initialContent);
      this.watchers.get(filePath)!.lastMtime = fs.statSync(filePath).mtimeMs;
    } catch {
      // file doesn't exist yet
    }

    try {
      fs.watch(dir, (eventType, filename) => {
        if (filename !== basename) return;
        this.handleFileEvent(filePath, onChange);
      });
    } catch {
      // fs.watch not available, mtime polling will handle it
    }

    const mtimeTimer = setInterval(() => {
      this.checkMtime(filePath, onChange);
    }, MTIME_POLL_MS);
    this.mtimeTimers.set(filePath, mtimeTimer);
  }

  private handleFileEvent(filePath: string, onChange: (content: string) => void): void {
    const entry = this.watchers.get(filePath);
    if (!entry) return;

    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }

    entry.debounceTimer = setTimeout(() => {
      this.processChange(filePath, onChange);
      entry.debounceTimer = null;
    }, DEBOUNCE_MS);
  }

  private checkMtime(filePath: string, onChange: (content: string) => void): void {
    const entry = this.watchers.get(filePath);
    if (!entry) return;

    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs > entry.lastMtime) {
        entry.lastMtime = stat.mtimeMs;
        this.handleFileEvent(filePath, onChange);
      }
    } catch {
      // file might not exist
    }
  }

  private processChange(filePath: string, onChange: (content: string) => void): void {
    const entry = this.watchers.get(filePath);
    if (!entry) return;

    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch {
      return;
    }

    const fileHash = this.hash(content);
    if (fileHash === entry.lastHash) {
      return;
    }

    entry.lastHash = fileHash;

    try {
      const stat = fs.statSync(filePath);
      entry.lastMtime = stat.mtimeMs;
    } catch {
      // ignore
    }

    try {
      onChange(content);
    } catch (error) {
      console.error(`[file-watcher] Error processing change to ${filePath}:`, error);
    }
  }

  private hash(content: string): string {
    return createHash("sha1").update(content).digest("hex").slice(0, 16);
  }

  private handleLoopsChange(content: string): void {
    if (!this.loopManager) return;

    let newLoops: LoopMeta[];
    try {
      newLoops = JSON.parse(content);
    } catch {
      console.error("[file-watcher] Malformed loops.json, keeping old state");
      return;
    }

    this.loopManager.reconcile(newLoops);
  }

  private handleTasksChange(content: string): void {
    if (!this.taskManager) return;

    let newTasks: TaskDefinition[];
    try {
      newTasks = JSON.parse(content);
    } catch {
      console.error("[file-watcher] Malformed tasks.json, keeping old state");
      return;
    }

    this.taskManager.reload(newTasks);
  }

  private handleProjectsChange(content: string): void {
    if (!this.projectManager) return;

    let newProjects: Project[];
    try {
      newProjects = JSON.parse(content);
    } catch {
      console.error("[file-watcher] Malformed projects.json, keeping old state");
      return;
    }

    this.projectManager.reload(newProjects);
  }

  watchRecipeDirectory(projectId: string, recipesDir: string): void {
    if (this.dirWatchers.has(recipesDir)) return;

    this.dirWatchers.set(recipesDir, { debounceTimer: null });

    try {
      fs.mkdirSync(recipesDir, { recursive: true });
    } catch {
      // directory may not be creatable (remote fs, permissions)
    }

    try {
      fs.watch(recipesDir, (eventType, filename) => {
        if (!filename || (!filename.endsWith(".yaml") && !filename.endsWith(".yml"))) return;
        this.handleRecipeFileEvent(projectId, recipesDir, filename);
      });
    } catch {
      // fs.watch not available on this path
    }
  }

  stopWatchingRecipeDirectory(recipesDir: string): void {
    const entry = this.dirWatchers.get(recipesDir);
    if (entry?.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }
    this.dirWatchers.delete(recipesDir);
  }

  private handleRecipeFileEvent(projectId: string, recipesDir: string, filename: string): void {
    if (!this.recipeScanner) return;

    const entry = this.dirWatchers.get(recipesDir);
    if (!entry) return;

    if (entry.debounceTimer) {
      clearTimeout(entry.debounceTimer);
    }

    entry.debounceTimer = setTimeout(() => {
      entry.debounceTimer = null;
      this.processRecipeFileChange(projectId, recipesDir, filename);
    }, DEBOUNCE_MS);
  }

  private processRecipeFileChange(projectId: string, recipesDir: string, filename: string): void {
    if (!this.recipeScanner || !this.loopManager) return;

    const filePath = path.join(recipesDir, filename);

    const existingRecipe = this.recipeScanner.findRecipeByPath(filePath);

    if (!fs.existsSync(filePath)) {
      if (existingRecipe) {
        this.recipeScanner.unloadRecipe(existingRecipe.id);
        this.deferredReload?.cancelReload(existingRecipe.id);
      }
      return;
    }

    if (existingRecipe) {
      const isRunning = this.loopManager.isRunning(existingRecipe.id);
      if (isRunning && this.deferredReload) {
        const entry = this.loopManager["recipes"].get(existingRecipe.id);
        if (entry) {
          this.deferredReload.requestReload(existingRecipe.id, filePath, entry.controller);
        }
      } else {
        this.recipeScanner.reloadRecipe(existingRecipe.id);
      }
    } else {
      this.recipeScanner.loadRecipe(projectId, filePath, filename);
    }
  }
}
