function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseStdout(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  let whole: unknown;
  try {
    whole = JSON.parse(trimmed);
  } catch {
    whole = undefined;
  }

  if (whole !== undefined) {
    if (isObject(whole)) {
      return whole;
    }
    if (typeof whole === "string" || typeof whole === "number" || typeof whole === "boolean" || whole === null) {
      return { output: String(whole) };
    }
    if (Array.isArray(whole)) {
      return { output: trimmed };
    }
  }

  const lines = trimmed.split("\n");
  const parsedLines: unknown[] = [];
  let jsonlSuccess = true;

  for (const line of lines) {
    const l = line.trim();
    if (l.length === 0) continue;

    try {
      parsedLines.push(JSON.parse(l));
    } catch {
      jsonlSuccess = false;
      break;
    }
  }

  if (jsonlSuccess && parsedLines.length > 0) {
    const result: Record<string, unknown> = {};
    for (const pl of parsedLines) {
      if (isObject(pl)) {
        Object.assign(result, pl);
      } else {
        result.output = String(pl);
      }
    }
    return result;
  }

  return { output: trimmed };
}

export function mergeCommandOutput(
  context: Record<string, unknown>,
  stdout: string,
  stderr: string,
): void {
  const parsed = parseStdout(stdout);
  if (parsed !== null) {
    Object.assign(context, parsed);
  }

  const output = [stdout, stderr].filter(Boolean).join("\n").trim();
  if (output.length > 0) {
    context.output = output;
  }
}
