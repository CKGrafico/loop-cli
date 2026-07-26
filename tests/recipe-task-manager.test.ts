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

describe("TaskManager with recipe tasks", () => {
  let tmpDir: string;
  let store: RecipeTaskStore;
  let scanner: RecipeScanner;
  let loopManager: LoopManager;
  let taskManager: TaskManager;
  let projectManager: ProjectManager;
  let projectId: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "recipe-tm-"));
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

  it("list() returns both user and recipe tasks", () => {
    const userTask = taskManager.create({
      id: "user-1",
      name: "User Task",
      command: "echo",
      commandArgs: ["user"],
      onSuccessTaskId: null,
      onFailureTaskId: null,
    });

    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );
    scanner.scanDirectory(projectId, tmpDir);

    const all = taskManager.list();
    const userIds = all.map((t) => t.id);
    expect(userIds).toContain(userTask.id);

    const recipeTasks = store.list();
    for (const rt of recipeTasks) {
      expect(userIds).toContain(rt.id);
    }
  });

  it("get() checks user first, then recipe store", () => {
    const userTask = taskManager.create({
      id: "user-2",
      name: "User Task 2",
      command: "echo",
      commandArgs: ["user2"],
      onSuccessTaskId: null,
      onFailureTaskId: null,
    });

    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );
    scanner.scanDirectory(projectId, tmpDir);

    expect(taskManager.get(userTask.id)).not.toBeNull();
    expect(taskManager.get(userTask.id)!.command).toBe("echo");

    const recipeTasks = store.list();
    expect(recipeTasks.length).toBeGreaterThan(0);
    const recipeTask = recipeTasks[0]!;
    expect(taskManager.get(recipeTask.id)).not.toBeNull();
    expect(taskManager.get(recipeTask.id)!.id).toBe(recipeTask.id);
  });

  it("update() throws for recipe tasks", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );
    scanner.scanDirectory(projectId, tmpDir);

    const recipeTasks = store.list();
    expect(recipeTasks.length).toBeGreaterThan(0);
    const recipeTask = recipeTasks[0]!;

    expect(() =>
      taskManager.update(recipeTask.id, {
        name: "Hacked",
        command: "rm",
        commandArgs: ["-rf"],
        onSuccessTaskId: null,
        onFailureTaskId: null,
      }),
    ).toThrow("Recipe tasks are immutable and cannot be updated");
  });

  it("delete() throws for recipe tasks", () => {
    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );
    scanner.scanDirectory(projectId, tmpDir);

    const recipeTasks = store.list();
    expect(recipeTasks.length).toBeGreaterThan(0);
    const recipeTask = recipeTasks[0]!;

    expect(() => taskManager.delete(recipeTask.id)).toThrow(
      "Recipe tasks are immutable and cannot be deleted",
    );
  });

  it("reload() only affects user tasks", () => {
    const userTask = taskManager.create({
      id: "user-3",
      name: "User Task 3",
      command: "echo",
      commandArgs: ["user3"],
      onSuccessTaskId: null,
      onFailureTaskId: null,
    });

    const recipesDir = path.join(tmpDir, ".loops/recipes");
    fs.mkdirSync(recipesDir, { recursive: true });
    fs.writeFileSync(
      path.join(recipesDir, "test.yaml"),
      yaml.dump(validRecipe),
    );
    scanner.scanDirectory(projectId, tmpDir);

    const recipeTasksBefore = store.list();
    expect(recipeTasksBefore.length).toBeGreaterThan(0);
    const recipeId = recipeTasksBefore[0]!.id;

    const newTasks = [
      {
        id: "reloaded-1",
        name: "Reloaded",
        command: "ls",
        commandArgs: [],
        onSuccessTaskId: null,
        onFailureTaskId: null,
        createdAt: new Date().toISOString(),
      },
    ];
    taskManager.reload(newTasks);

    expect(taskManager.get("reloaded-1")).not.toBeNull();
    expect(taskManager.get(userTask.id)).toBeNull();

    expect(taskManager.get(recipeId)).not.toBeNull();

    const all = taskManager.list();
    const ids = all.map((t) => t.id);
    expect(ids).toContain(recipeId);
    expect(ids).toContain("reloaded-1");
  });
});
