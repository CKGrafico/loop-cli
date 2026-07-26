import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as yaml from "js-yaml";
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

function createTestManagers(tmpDir: string) {
  process.env.LOOP_CLI_HOME = tmpDir;
  const projectManager = new ProjectManager();
  projectManager.init();
  const taskManager = new TaskManager();
  taskManager.init();
  const loopManager = new LoopManager(taskManager, projectManager);
  return { loopManager, taskManager, projectManager };
}

describe("LoopManager with recipe loops", () => {
  let tmpDir: string;
  let store: RecipeTaskStore;
  let scanner: RecipeScanner;
  let loopManager: LoopManager;
  let taskManager: TaskManager;
  let projectManager: ProjectManager;
  let projectId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-lm-"));
    store = new RecipeTaskStore();
    scanner = new RecipeScanner(store);

    const managers = createTestManagers(tmpDir);
    loopManager = managers.loopManager;
    taskManager = managers.taskManager;
    projectManager = managers.projectManager;
    taskManager.setRecipeTaskStore(store);
    projectId = projectManager.create("TestProject", "#ffffff", tmpDir).id;
    scanner.setManagers(loopManager, projectManager);
    loopManager.setRecipeScanner(scanner);
  });

  afterEach(() => {
    delete process.env.LOOP_CLI_HOME;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("recipe loops appear in list() output with isRecipe:true", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory(projectId, tmpDir);

    const loops = loopManager.list();
    const recipeLoop = loops.find((l) => l.isRecipe === true);
    expect(recipeLoop).toBeDefined();
    expect(recipeLoop!.recipeFile).toBe("test.yaml");
  });

  it("update on recipe loop allows only overridable fields", async () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory(projectId, tmpDir);
    const loops = loopManager.list();
    const recipeLoop = loops.find((l) => l.isRecipe === true)!;

    const entry = loopManager["recipes"].get(recipeLoop.id)!;
    const opts = entry.options;

    await expect(
      loopManager.update(recipeLoop.id, { ...opts, command: "ls" }, "manual"),
    ).rejects.toThrow("Recipe loops only allow editing interval, maxRuns, and context");

    await expect(
      loopManager.update(recipeLoop.id, { ...opts, maxRuns: 5 }, "manual"),
    ).resolves.toBe(true);
  });

  it("delete on recipe loop throws", async () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory(projectId, tmpDir);
    const loops = loopManager.list();
    const recipeLoop = loops.find((l) => l.isRecipe === true)!;

    await expect(loopManager.delete(recipeLoop.id)).rejects.toThrow(
      "Recipe loops cannot be deleted; remove the recipe file instead",
    );
  });

  it("deleteProject removes recipe loops", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );

    scanner.scanDirectory(projectId, tmpDir);
    expect(loopManager.list().some((l) => l.isRecipe)).toBe(true);

    loopManager.deleteProject(projectId);

    expect(loopManager.list().some((l) => l.isRecipe)).toBe(false);
  });

  it("project directory change removes old recipe loops and loads new", () => {
    const oldDir = path.join(tmpDir, "old");
    const newDir = path.join(tmpDir, "new");
    fs.mkdirSync(path.join(oldDir, ".loops/recipes"), { recursive: true });
    fs.writeFileSync(
      path.join(oldDir, ".loops/recipes", "old.yaml"),
      yaml.dump(validRecipe),
    );
    fs.mkdirSync(path.join(newDir, ".loops/recipes"), { recursive: true });
    fs.writeFileSync(
      path.join(newDir, ".loops/recipes", "new.yaml"),
      yaml.dump(validRecipe),
    );

    const proj = projectManager.create("DirProj", "#ff0000", oldDir);
    scanner.scanDirectory(proj.id, oldDir);

    let loops = loopManager.list().filter((l) => l.isRecipe);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.recipeFile).toBe("old.yaml");

    projectManager.setOnDirectoryChange((pId, _old, nDir) => {
      scanner.unloadRecipesForProject(pId);
      if (nDir) {
        scanner.scanDirectory(pId, nDir);
      }
    });
    projectManager.update(proj.id, "DirProj", "#ff0000", newDir);

    loops = loopManager.list().filter((l) => l.isRecipe);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.recipeFile).toBe("new.yaml");
  });
});
