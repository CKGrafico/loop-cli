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
  opencode?: unknown,
): void {
  const parsed = parseStdout(stdout);
  if (parsed !== null) {
    Object.assign(context, parsed);
  }

  if (opencode && typeof opencode === "object") {
    const incoming = opencode as Record<string, unknown>;
    const existing = context.opencode as Record<string, unknown> | undefined;

    if (
      existing &&
      typeof existing === "object" &&
      existing.session &&
      incoming.session &&
      (existing.session as Record<string, unknown>).id === (incoming.session as Record<string, unknown>).id
    ) {
      context.opencode = accumulateOpencodeContext(existing, incoming);
    } else {
      context.opencode = opencode;
    }
  }

  const output = [stdout, stderr].filter(Boolean).join("\n").trim();
  if (output.length > 0) {
    context.output = output;
  }
}

function accumulateOpencodeContext(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const existingTokens = (existing.tokens ?? {}) as Record<string, unknown>;
  const incomingTokens = (incoming.tokens ?? {}) as Record<string, unknown>;
  const existingCache = (existingTokens.cache ?? {}) as Record<string, unknown>;
  const incomingCache = (incomingTokens.cache ?? {}) as Record<string, unknown>;

  const existingTools = (existing.tools ?? {}) as Record<string, unknown>;
  const incomingTools = (incoming.tools ?? {}) as Record<string, unknown>;
  const existingToolNames = (existingTools.names ?? []) as string[];
  const incomingToolNames = (incomingTools.names ?? []) as string[];

  return {
    // Session: keep latest (messageId may differ per task, but session.id is the same)
    session: incoming.session,
    // Tokens: sum across all tasks in the same session
    tokens: {
      input: ((existingTokens.input as number) ?? 0) + ((incomingTokens.input as number) ?? 0),
      output: ((existingTokens.output as number) ?? 0) + ((incomingTokens.output as number) ?? 0),
      reasoning: ((existingTokens.reasoning as number) ?? 0) + ((incomingTokens.reasoning as number) ?? 0),
      cache: {
        read: ((existingCache.read as number) ?? 0) + ((incomingCache.read as number) ?? 0),
        write: ((existingCache.write as number) ?? 0) + ((incomingCache.write as number) ?? 0),
      },
    },
    // Cost: sum
    cost: ((existing.cost as number) ?? 0) + ((incoming.cost as number) ?? 0),
    // Tools: sum counts, union names
    tools: {
      count: ((existingTools.count as number) ?? 0) + ((incomingTools.count as number) ?? 0),
      names: [...new Set([...existingToolNames, ...incomingToolNames])],
    },
    gitSnapshot: incoming.gitSnapshot ?? existing.gitSnapshot,
    error: incoming.error ?? existing.error,
    text: incoming.text ?? existing.text,
  };
}

/**
 * Resolve a dotted key path (e.g., "opencode.tokens.input") from a context object.
 * When the resolved value is an object (not array, not null), render as indented JSON.
 * Returns the string representation for interpolation into command args.
 */
export function resolveContextValue(
  context: Record<string, unknown>,
  key: string,
): string | undefined {
  const parts = key.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  if (current === undefined || current === null) return undefined;

  // Objects and arrays render as indented JSON
  if (typeof current === "object") {
    return JSON.stringify(current, null, 2);
  }

  return String(current);
}
