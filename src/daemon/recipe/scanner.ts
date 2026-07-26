import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as yaml from "js-yaml";
import { LoopController } from "../../core/loop/loop-controller.js";
import type { LoopOptions } from "../../types.js";
import type { StoredLoop } from "../managers/loop-options.js";
import type { LoopManager } from "../managers/loop-manager.js";
import type { ProjectManager } from "../managers/project-manager.js";
import { validateRecipeFile } from "./validator.js";
import { remapRecipeIds } from "./id-remapper.js";
import { RecipeTaskStore } from "./task-store.js";
import { getLogPath } from "../state/index.js";
import { daemonLog } from "../daemon-log.js";
import { parseDuration } from "../../duration.js";
import { loadRecipeRuntimeState, saveRecipeRuntimeState } from "./runtime-state.js";

const RECIPE_EXTENSIONS = [".yaml", ".yml"];

export interface RecipeEntry {
  id: string;
  projectId: string;
  recipeFile: string;
  filePath: string;
  taskIds: string[];
}

const RECIPE_DIR = ".loops/recipes";

export function recipeLoopId(projectId: string, filePath: string): string {
  return `recipe-${crypto.createHash("sha1").update(`${projectId}:${path.resolve(filePath)}`).digest("hex").slice(0, 16)}`;
}

export class RecipeScanner {
  private recipeTaskStore: RecipeTaskStore;
  private loopManager: LoopManager | null = null;
  private projectManager: ProjectManager | null = null;
  private recipes = new Map<string, RecipeEntry>();

  constructor(recipeTaskStore: RecipeTaskStore) {
    this.recipeTaskStore = recipeTaskStore;
  }

  setManagers(loopManager: LoopManager, projectManager: ProjectManager): void {
    this.loopManager = loopManager;
    this.projectManager = projectManager;
  }

  getRecipeTaskStore(): RecipeTaskStore {
    return this.recipeTaskStore;
  }

  getRecipe(recipeId: string): RecipeEntry | undefined {
    return this.recipes.get(recipeId);
  }

  listRecipes(): RecipeEntry[] {
    return [...this.recipes.values()];
  }

  scanAllProjects(): void {
    if (!this.projectManager) return;
    const projects = this.projectManager.getAll();
    for (const project of projects) {
      if (project.directory) {
        this.scanDirectory(project.id, project.directory);
      }
    }
  }

  scanDirectory(projectId: string, projectDir: string): void {
    const recipesDir = path.join(projectDir, RECIPE_DIR);
    if (!fs.existsSync(recipesDir)) return;

    try {
      const files = fs.readdirSync(recipesDir).filter((f) => RECIPE_EXTENSIONS.some((ext) => f.endsWith(ext)));
      for (const file of files) {
        const filePath = path.join(recipesDir, file);
        this.loadRecipe(projectId, filePath, file);
      }
    } catch (err) {
      daemonLog(`error scanning recipes directory ${recipesDir}: ${String(err)}`);
    }
  }

  loadRecipe(projectId: string, filePath: string, fileName: string): string | null {
    if (!this.loopManager) return null;

    const existing = this.findRecipeByPath(filePath);
    if (existing) {
      return existing.id;
    }

    let raw: unknown;
    try {
      raw = yaml.load(fs.readFileSync(filePath, "utf-8"));
    } catch (err) {
      daemonLog(`error reading recipe file ${filePath}: ${String(err)}`);
      return null;
    }

    const validation = validateRecipeFile(raw);
    if (!validation.valid) {
      daemonLog(`invalid recipe file ${filePath}: ${validation.error}`);
      return null;
    }

    const recipe = validation.data!;
    const { loop: recipeLoop, tasks } = remapRecipeIds(recipe);

    const id = recipeLoopId(projectId, filePath);
    const taskIds = tasks.map((t) => t.id);

    this.recipeTaskStore.setMany(tasks);

    const projectDir = this.projectManager?.get(projectId)?.directory ?? "";
    const intervalHuman = recipeLoop.intervalHuman ?? "0";
    const interval = intervalHuman === "0" || intervalHuman === "manual" ? 0 : parseDuration(intervalHuman);

    const options: LoopOptions = {
      interval,
      taskId: recipeLoop.taskId ?? null,
      command: recipeLoop.command ?? "",
      commandArgs: recipeLoop.commandArgs ?? [],
      cwd: projectDir,
      immediate: recipeLoop.immediate ?? false,
      maxRuns: recipeLoop.maxRuns ?? null,
      verbose: recipeLoop.verbose ?? false,
      description: recipeLoop.description ?? "",
      projectId,
      offset: recipeLoop.offset ?? null,
      context: recipeLoop.context,
    };

    const taskResolver = (taskId: string) =>
      this.recipeTaskStore.get(taskId) ?? null;

    const logPath = getLogPath(id);
    const controller = new LoopController(
      id,
      options,
      logPath,
      taskResolver,
      loadRecipeRuntimeState(id),
      projectDir,
    );

    const entry: StoredLoop = { controller, options, intervalHuman };
    this.loopManager.addRecipeLoop(id, entry, fileName, () => {
      saveRecipeRuntimeState(id, controller.getMeta());
    });

    this.recipes.set(id, {
      id,
      projectId,
      recipeFile: fileName,
      filePath,
      taskIds,
    });

    controller.start();

    daemonLog(`loaded recipe loop ${id} from ${fileName} (project: ${projectId})`);
    return id;
  }

  unloadRecipe(recipeId: string): void {
    if (!this.loopManager) return;

    const entry = this.recipes.get(recipeId);
    if (!entry) return;

    this.loopManager.removeRecipeLoop(recipeId);

    this.recipeTaskStore.deleteMany(entry.taskIds);
    this.recipes.delete(recipeId);

    daemonLog(`unloaded recipe loop ${recipeId} from ${entry.recipeFile}`);
  }

  reloadRecipe(recipeId: string): void {
    const entry = this.recipes.get(recipeId);
    if (!entry) return;

    this.unloadRecipe(recipeId);
    this.loadRecipe(entry.projectId, entry.filePath, entry.recipeFile);
  }

  unloadRecipesForProject(projectId: string): void {
    const toRemove: string[] = [];
    for (const [id, entry] of this.recipes) {
      if (entry.projectId === projectId) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      this.unloadRecipe(id);
    }
  }

  findRecipeByPath(filePath: string): RecipeEntry | undefined {
    for (const entry of this.recipes.values()) {
      if (entry.filePath === filePath) return entry;
    }
    return undefined;
  }

  findRecipeByFileName(projectId: string, fileName: string): RecipeEntry | undefined {
    for (const entry of this.recipes.values()) {
      if (entry.projectId === projectId && entry.recipeFile === fileName) return entry;
    }
    return undefined;
  }
}
