import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as yaml from "js-yaml";
import { RecipeScanner } from "../src/daemon/recipe/scanner.js";
import { RecipeTaskStore } from "../src/daemon/recipe/task-store.js";
import { saveRecipeRuntimeState } from "../src/daemon/recipe/runtime-state.js";
import type { RecipeFile } from "../src/daemon/recipe/validator.js";
import { LoopManager } from "../src/daemon/managers/loop-manager.js";
import { TaskManager } from "../src/daemon/managers/task-manager.js";
import { ProjectManager } from "../src/daemon/managers/project-manager.js";

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

function createTestManagers(tmpDir: string): { loopManager: LoopManager; taskManager: TaskManager; projectManager: ProjectManager } {
  process.env.LOOP_CLI_HOME = tmpDir;
  const projectManager = new ProjectManager();
  projectManager.init();
  const taskManager = new TaskManager();
  taskManager.init();
  const loopManager = new LoopManager(taskManager, projectManager);
  return { loopManager, taskManager, projectManager };
}

describe("RecipeScanner", () => {
  let tmpDir: string;
  let store: RecipeTaskStore;
  let scanner: RecipeScanner;
  let loopManager: LoopManager;
  let projectId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-test-"));
    store = new RecipeTaskStore();
    scanner = new RecipeScanner(store);

    const managers = createTestManagers(tmpDir);
    loopManager = managers.loopManager;
    const { taskManager, projectManager } = managers;
    taskManager.setRecipeTaskStore(store);
    projectId = projectManager.create("TestProject", "#ffffff", tmpDir).id;
    scanner.setManagers(loopManager, projectManager);
    loopManager.setRecipeScanner(scanner);
  });

  afterEach(() => {
    delete process.env.LOOP_CLI_HOME;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scanDirectory loads recipe files", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory("test-project", tmpDir);

    const recipes = scanner.listRecipes();
    expect(recipes.length).toBe(1);
    expect(recipes[0]!.recipeFile).toBe("test.yaml");
    expect(recipes[0]!.projectId).toBe("test-project");
  });

  it("scanDirectory skips when .loops/recipes does not exist", () => {
    scanner.scanDirectory(projectId, tmpDir);
    expect(scanner.listRecipes()).toHaveLength(0);
  });

  it("scanDirectory discovers recipes added after the initial scan", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "first.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory("test-project", tmpDir);
    fs.writeFileSync(
      path.join(recipesDir, "second.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory("test-project", tmpDir);

    expect(scanner.listRecipes()).toHaveLength(2);
  });

  it("unloadRecipe removes recipe and tasks", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory("test-project", tmpDir);
    const recipe = scanner.listRecipes()[0]!;
    scanner.unloadRecipe(recipe.id);

    expect(scanner.listRecipes()).toHaveLength(0);
    expect(store.list()).toHaveLength(0);
  });

  it("reloadRecipe replaces recipe in memory", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    const filePath = path.join(recipesDir, "test.yaml");
    fs.writeFileSync(filePath, yaml.dump(validRecipe));

    scanner.scanDirectory("test-project", tmpDir);
    const oldRecipe = scanner.listRecipes()[0]!;
    const oldTaskId = oldRecipe.taskIds[0];

    scanner.reloadRecipe(oldRecipe.id);

    const recipes = scanner.listRecipes();
    expect(recipes).toHaveLength(1);
    // Task IDs should be regenerated (different from before)
    const newRecipe = recipes[0]!;
    expect(newRecipe.taskIds[0]).not.toBe(oldTaskId);
  });

  it("preserves identity and run history across a daemon restart", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    const recipePath = path.join(recipesDir, "history.yaml");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(recipePath, yaml.dump(validRecipe));

    scanner.scanDirectory(projectId, tmpDir);
    const original = scanner.listRecipes()[0]!;
    saveRecipeRuntimeState(original.id, {
      status: "idle",
      runCount: 2,
      totalRunCount: 2,
      lastRunAt: "2026-07-26T10:00:00.000Z",
      lastExitCode: 0,
      lastDuration: 42,
      runHistory: [{ startedAt: "2026-07-26T10:00:00.000Z", endedAt: "2026-07-26T10:00:00.042Z", duration: 42, exitCode: 0, status: "completed", logOffset: 0 }],
    });

    const restartedStore = new RecipeTaskStore();
    const restartedScanner = new RecipeScanner(restartedStore);
    const restartedManagers = createTestManagers(tmpDir);
    restartedManagers.taskManager.setRecipeTaskStore(restartedStore);
    restartedScanner.setManagers(restartedManagers.loopManager, restartedManagers.projectManager);
    restartedManagers.loopManager.setRecipeScanner(restartedScanner);
    restartedScanner.scanDirectory(projectId, tmpDir);

    const reloaded = restartedScanner.listRecipes()[0]!;
    const loop = restartedManagers.loopManager.list().find((item) => item.id === reloaded.id)!;
    expect(reloaded.id).toBe(original.id);
    expect(loop.runCount).toBe(2);
    expect(loop.runHistory).toHaveLength(1);
  });

  it("skips malformed recipe files", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(path.join(recipesDir, "bad.yaml"), "not: valid: yaml: [[{");
    fs.writeFileSync(
      path.join(recipesDir, "good.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory("test-project", tmpDir);

    const recipes = scanner.listRecipes();
    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.recipeFile).toBe("good.yaml");
  });

  it("unloadRecipesForProject removes all recipes for a project", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "a.yaml"),
      yaml.dump(validRecipe),
    );
    fs.writeFileSync(
      path.join(recipesDir, "b.yaml"),
      yaml.dump({ ...validRecipe, loops: [{ ...validRecipe.loops[0], taskId: "echo" }], tasks: [{ ...validRecipe.tasks[0], id: "echo" }] }),
    );

    scanner.scanDirectory("test-project", tmpDir);
    expect(scanner.listRecipes()).toHaveLength(2);

    scanner.unloadRecipesForProject("test-project");
    expect(scanner.listRecipes()).toHaveLength(0);
  });
});
