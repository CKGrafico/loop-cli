import fs from "node:fs";
import type { LoopControllerState } from "../../core/loop/types.js";
import { writeFileAtomic } from "../../shared/fs-utils.js";
import { getDataDir, recipeRuntimeJson } from "../../shared/config/paths.js";

type RecipeRuntimeStates = Record<string, LoopControllerState>;

function loadAll(): RecipeRuntimeStates {
  try {
    const parsed = JSON.parse(fs.readFileSync(recipeRuntimeJson(), "utf-8"));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as RecipeRuntimeStates
      : {};
  } catch {
    return {};
  }
}

export function loadRecipeRuntimeState(id: string): LoopControllerState | undefined {
  return loadAll()[id];
}

export function saveRecipeRuntimeState(id: string, state: LoopControllerState): void {
  fs.mkdirSync(getDataDir(), { recursive: true });
  const states = loadAll();
  states[id] = state;
  writeFileAtomic(recipeRuntimeJson(), JSON.stringify(states, null, 2));
}
