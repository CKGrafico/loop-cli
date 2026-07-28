function shellEscape(value: string): string {
  if (value.length === 0) return '""';
  // If the value is purely safe characters, pass it through unmodified
  if (/^[A-Za-z0-9_\-=:./,@]+$/.test(value)) return value;
  // Escape characters that are dangerous inside double quotes, then wrap
  // the whole value in single quotes  the strongest shell quoting.
  // Single quotes preserve everything literally (newlines, backticks,
  // $, ", \, parens) except single quotes themselves.
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function resolveNestedValue(context: Record<string, unknown>, key: string): unknown {
  const parts = key.split(".");
  let current: unknown = context;

  for (const part of parts) {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

export function interpolate(input: string, context: Record<string, unknown>): string {
  return input.replace(/{{([\w.]+)}}/g, (_, key: string) => {
    const raw = resolveNestedValue(context, key);
    if (raw === undefined || raw === null) return "";

    if (typeof raw === "object") {
      return shellEscape(JSON.stringify(raw, null, 2));
    }

    return shellEscape(String(raw));
  });
}
