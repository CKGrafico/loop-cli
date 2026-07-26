import fs from "node:fs";
import { Document, parseDocument } from "yaml";
import { writeFileAtomic } from "../../shared/fs-utils.js";

type SelfWriteNotifier = (filePath: string, content: string) => void;

let selfWriteNotifier: SelfWriteNotifier | null = null;

export function setRecipeSelfWriteNotifier(notifier: SelfWriteNotifier | null): void {
  selfWriteNotifier = notifier;
}

export interface RecipeOverrideFields {
  intervalHuman?: string;
  maxRuns?: number | null;
  context?: Record<string, unknown>;
}

/**
 * Writes recipe override fields back to the YAML file.
 *
 * Uses the `yaml` package's Document API for AST-preserving round-trips:
 * only the touched leaf fields (`loops[0].intervalHuman`, `maxRuns`,
 * `context`) are mutated in place. Every other node, including a
 * `diagram:` block scalar holding ASCII art, survives byte-for-byte.
 */
export function writeRecipeOverrides(
  filePath: string,
  overrides: RecipeOverrideFields,
): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Recipe file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const doc = parseDocument(raw);

  if (doc.errors.length > 0) {
    throw new Error(`Recipe file is not valid YAML: ${filePath}: ${doc.errors[0].message}`);
  }

  const root = doc.contents;
  if (!root || root.type !== "MAP") {
    throw new Error(`Recipe file has no root mapping: ${filePath}`);
  }

  const loopsNode = root.get("loops");
  if (!loopsNode || loopsNode.type !== "SEQ" || (loopsNode.items.length ?? 0) === 0) {
    throw new Error(`Recipe file has no loops: ${filePath}`);
  }

  const loop = loopsNode.items[0];
  if (!loop || loop.type !== "MAP") {
    throw new Error(`Recipe loops[0] is not a mapping: ${filePath}`);
  }

  if (overrides.intervalHuman !== undefined) {
    loop.set("intervalHuman", overrides.intervalHuman);
  }
  if (overrides.maxRuns !== undefined) {
    loop.set("maxRuns", overrides.maxRuns);
  }
  if (overrides.context !== undefined) {
    loop.set("context", overrides.context);
  }

  const content = String(doc);
  writeFileAtomic(filePath, content);

  if (selfWriteNotifier) {
    selfWriteNotifier(filePath, content);
  }
}
