import crypto from "node:crypto";
import { DEFAULT_TASK_MAX_RUNS, type TaskDefinition } from "../../types.js";
import type { RecipeFile, RecipeLoopsEntry } from "./validator.js";

export interface RemappedRecipe {
  loop: RecipeLoopsEntry;
  tasks: TaskDefinition[];
  remapTable: Map<string, string>;
}

export function remapRecipeIds(recipe: RecipeFile, projectId?: string): RemappedRecipe {
  const remapTable = new Map<string, string>();

  for (const task of recipe.tasks) {
    const newId = crypto.randomBytes(4).toString("hex");
    remapTable.set(task.id, newId);
  }

  const tasks: TaskDefinition[] = recipe.tasks.map((task) => {
    const remappedTask: TaskDefinition = {
      id: remapTable.get(task.id)!,
      name: task.name ?? task.id,
      command: task.command ?? "",
      commandArgs: task.commandArgs ?? [],
      onSuccessTaskId: task.onSuccessTaskId ? remapTable.get(task.onSuccessTaskId) ?? null : null,
      onFailureTaskId: task.onFailureTaskId ? remapTable.get(task.onFailureTaskId) ?? null : null,
      maxRuns: DEFAULT_TASK_MAX_RUNS,
      createdAt: new Date().toISOString(),
      isRecipeTask: true,
      projectId,
    };

    if (task.silentChain !== undefined) {
      remappedTask.silentChain = task.silentChain;
    }
    if (task.context !== undefined) {
      remappedTask.context = task.context;
    }
    if (task.steps) {
      remappedTask.steps = task.steps.map((step) => ({
        commands: step.commands.map((cmd) => ({
          command: cmd.command,
          commandArgs: cmd.commandArgs,
        })),
      }));
    }
    if (task.commandRaw !== undefined) {
      remappedTask.commandRaw = task.commandRaw;
    }

    return remappedTask;
  });

  const loop = { ...recipe.loops[0] };
  if (loop.taskId) {
    loop.taskId = remapTable.get(loop.taskId) ?? loop.taskId;
  }

  return { loop, tasks, remapTable };
}
