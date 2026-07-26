import { describe, it, expect } from "vitest";
import { validateRecipeFile } from "../src/daemon/recipe/validator.js";
import type { RecipeFile } from "../src/daemon/recipe/validator.js";

const validRecipe: RecipeFile = {
  version: 2,
  loops: [
    {
      taskId: "select",
      interval: 1800000,
      intervalHuman: "30m",
      immediate: false,
      maxRuns: null,
      verbose: false,
      description: "Refine issues",
    },
  ],
  tasks: [
    {
      id: "select",
      name: "Select issue",
      command: "gh",
      commandArgs: ["issue", "list"],
      onSuccessTaskId: "refine",
      onFailureTaskId: "noop",
    },
    {
      id: "refine",
      name: "AI Refinement",
      command: "opencode",
      commandArgs: ["run", "Rewrite"],
      onSuccessTaskId: null,
      onFailureTaskId: null,
    },
    {
      id: "noop",
      name: "Silent terminator",
      command: "echo",
      commandArgs: ["Nothing to do"],
      silentChain: true,
      onSuccessTaskId: null,
      onFailureTaskId: null,
    },
  ],
  projects: [],
};

describe("validateRecipeFile", () => {
  it("accepts a valid recipe file", () => {
    const result = validateRecipeFile(validRecipe);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.loops).toHaveLength(1);
    expect(result.data!.tasks).toHaveLength(3);
  });

  it("rejects non-object input", () => {
    const result = validateRecipeFile("not an object");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("mapping");
  });

  it("rejects missing version", () => {
    const { version: _, ...noVersion } = validRecipe;
    const result = validateRecipeFile(noVersion);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("version");
  });

  it("rejects wrong version", () => {
    const result = validateRecipeFile({ ...validRecipe, version: 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported");
  });

  it("rejects empty loops array", () => {
    const result = validateRecipeFile({ ...validRecipe, loops: [] });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exactly one loop");
  });

  it("rejects multiple loops", () => {
    const result = validateRecipeFile({
      ...validRecipe,
      loops: [validRecipe.loops[0], validRecipe.loops[0]],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exactly one loop");
  });

  it("rejects missing tasks array", () => {
    const { tasks: _, ...noTasks } = validRecipe;
    const result = validateRecipeFile(noTasks);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("tasks");
  });

  it("rejects task without id", () => {
    const badRecipe = {
      ...validRecipe,
      tasks: [{ name: "no-id", command: "echo", commandArgs: [] }],
    };
    const result = validateRecipeFile(badRecipe);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("id");
  });
});
