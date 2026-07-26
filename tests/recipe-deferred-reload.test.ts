import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import * as yaml from "js-yaml";
import { DeferredReloadManager } from "../src/daemon/recipe/deferred-reload.js";
import { RecipeScanner } from "../src/daemon/recipe/scanner.js";
import { RecipeTaskStore } from "../src/daemon/recipe/task-store.js";
import { LoopManager } from "../src/daemon/managers/loop-manager.js";
import { TaskManager } from "../src/daemon/managers/task-manager.js";
import { ProjectManager } from "../src/daemon/managers/project-manager.js";
import type { RecipeFile } from "../src/daemon/recipe/validator.js";

const validRecipe: RecipeFile = {
  version: 2,
  loops: [
    {
      taskId: "echo",
      interval: 0,
      intervalHuman: "manual",
      description: "Test recipe",
    },
  ],
  tasks: [
    {
      id: "echo",
      name: "Echo",
      command: "echo",
      commandArgs: ["hello"],
      onSuccessTaskId: null,
      onFailureTaskId: null,
    },
  ],
  projects: [],
};

class MockController extends EventEmitter {
  status: "running" | "idle" | "paused" | "waiting" | "stopped";

  constructor(status: "running" | "idle" | "paused" | "waiting" | "stopped" = "idle") {
    super();
    this.status = status;
  }
}

function createTestManagers(tmpDir: string) {
  process.env.LOOP_CLI_HOME = tmpDir;
  const projectManager = new ProjectManager();
  projectManager.init();
  const taskManager = new TaskManager();
  taskManager.init();
  const loopManager = new LoopManager(taskManager, projectManager);
  return { loopManager, taskManager, projectManager };
}

describe("DeferredReloadManager", () => {
  let tmpDir: string;
  let store: RecipeTaskStore;
  let scanner: RecipeScanner;
  let drm: DeferredReloadManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-drm-"));
    store = new RecipeTaskStore();
    scanner = new RecipeScanner(store);
    drm = new DeferredReloadManager(scanner);

    const { loopManager, taskManager, projectManager } = createTestManagers(tmpDir);
    taskManager.setRecipeTaskStore(store);
    projectManager.create("TestProject", "#ffffff", tmpDir);
    scanner.setManagers(loopManager, projectManager);
    loopManager.setRecipeScanner(scanner);
  });

  afterEach(() => {
    delete process.env.LOOP_CLI_HOME;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reloads immediately when loop is not running", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory("TestProject", tmpDir);
    const recipe = scanner.listRecipes()[0]!;
    const oldTaskId = recipe.taskIds[0];

    const mockCtrl = new MockController("idle");
    drm.requestReload(recipe.id, recipe.filePath, mockCtrl as never);

    const recipes = scanner.listRecipes();
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.taskIds[0]).not.toBe(oldTaskId);
  });

  it("defers reload when loop is running", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory("TestProject", tmpDir);
    const recipe = scanner.listRecipes()[0]!;
    const oldTaskId = recipe.taskIds[0];

    const mockCtrl = new MockController("running");
    drm.requestReload(recipe.id, recipe.filePath, mockCtrl as never);

    expect(drm.hasPending(recipe.id)).toBe(true);
    const tasksBefore = store.list().map((t) => t.id);
    expect(tasksBefore).toContain(oldTaskId);

    mockCtrl.emit("stopped");

    expect(drm.hasPending(recipe.id)).toBe(false);
    const recipes = scanner.listRecipes();
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.taskIds[0]).not.toBe(oldTaskId);
  });

  it("cancelReload removes pending reload", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory("TestProject", tmpDir);
    const recipe = scanner.listRecipes()[0]!;

    const mockCtrl = new MockController("running");
    drm.requestReload(recipe.id, recipe.filePath, mockCtrl as never);
    expect(drm.hasPending(recipe.id)).toBe(true);

    drm.cancelReload(recipe.id);
    expect(drm.hasPending(recipe.id)).toBe(false);
  });

  it("clear removes all pending reloads", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "a.yaml"),
      yaml.dump(validRecipe),
    );
    fs.writeFileSync(
      path.join(recipesDir, "b.yaml"),
      yaml.dump(
        { ...validRecipe, loops: [{ ...validRecipe.loops[0], taskId: "echo" }], tasks: [{ ...validRecipe.tasks[0], id: "echo" }] },
      ),
    );

    scanner.scanDirectory("TestProject", tmpDir);
    const recipes = scanner.listRecipes();

    const mockCtrl = new MockController("running");
    for (const r of recipes) {
      drm.requestReload(r.id, r.filePath, mockCtrl as never);
    }

    expect(recipes.length).toBeGreaterThanOrEqual(2);
    for (const r of recipes) {
      expect(drm.hasPending(r.id)).toBe(true);
    }

    drm.clear();

    for (const r of recipes) {
      expect(drm.hasPending(r.id)).toBe(false);
    }
  });
});
