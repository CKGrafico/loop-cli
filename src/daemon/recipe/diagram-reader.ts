import fs from "node:fs";
import * as yaml from "js-yaml";

/**
 * Read the `diagram` field from a recipe YAML file.
 * Returns the diagram text if present, or null if the file has no diagram.
 * Throws if the file cannot be read or parsed.
 */
export function readRecipeDiagram(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Recipe file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = yaml.load(raw) as Record<string, unknown> | null;

  if (!data || typeof data !== "object") {
    throw new Error(`Recipe file is not a valid YAML mapping: ${filePath}`);
  }

  const diagram = data.diagram;
  if (diagram === undefined || diagram === null) {
    return null;
  }

  if (typeof diagram !== "string") {
    return null;
  }

  // Trim trailing newline that YAML block scalars often add
  return diagram.replace(/\n$/, "");
}
