export interface RecipeLoopsEntry {
  taskId?: string;
  intervalHuman?: string;
  immediate?: boolean;
  maxRuns?: number | null;
  verbose?: boolean;
  description?: string;
  offset?: number | null;
  context?: Record<string, unknown>;
  cwd?: string;
  command?: string;
  commandArgs?: string[];
}

export interface RecipeFile {
  version: number;
  loops: RecipeLoopsEntry[];
  tasks: RecipeTaskEntry[];
  projects?: unknown[];
}

export interface RecipeTaskEntry {
  id: string;
  name?: string;
  command?: string;
  commandArgs?: string[];
  commandRaw?: string;
  onSuccessTaskId?: string | null;
  onFailureTaskId?: string | null;
  silentChain?: boolean;
  context?: Record<string, unknown>;
  steps?: { commands: { command: string; commandArgs: string[] }[] }[];
}

export interface RecipeValidationResult {
  valid: boolean;
  error?: string;
  data?: RecipeFile;
}

export function validateRecipeFile(raw: unknown): RecipeValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, error: "Recipe file must be a mapping (root object)" };
  }

  const data = raw as Record<string, unknown>;

  if (!("version" in data)) {
    return { valid: false, error: "Missing export version. Expected: 2" };
  }

  if (data.version !== 2) {
    return { valid: false, error: `Unsupported export version: ${data.version}. Expected: 2` };
  }

  if (!("loops" in data) || !Array.isArray(data.loops)) {
    return { valid: false, error: "Missing or invalid 'loops' array" };
  }

  if (data.loops.length === 0) {
    return { valid: false, error: "Recipe file must have exactly one loop in 'loops' array" };
  }

  if (data.loops.length > 1) {
    return { valid: false, error: "Recipe file must have exactly one loop, found " + data.loops.length };
  }

  if (!("tasks" in data) || !Array.isArray(data.tasks)) {
    return { valid: false, error: "Missing or invalid 'tasks' array" };
  }

  for (let i = 0; i < (data.tasks as unknown[]).length; i++) {
    const task = (data.tasks as unknown[])[i];
    if (typeof task !== "object" || task === null) {
      return { valid: false, error: `tasks[${i}]: must be an object` };
    }
    const record = task as Record<string, unknown>;
    if (!record.id || typeof record.id !== "string") {
      return { valid: false, error: `tasks[${i}]: missing or invalid 'id' field` };
    }
  }

  return { valid: true, data: data as unknown as RecipeFile };
}
