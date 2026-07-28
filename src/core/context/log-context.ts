export function formatContextLog(context: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined || value === null) continue;

    if (typeof value === "string") {
      const truncated = value.length > 200 ? value.slice(0, 200) + "..." : value;
      lines.push(`  ${key}: ${truncateOneline(truncated)}`);
    } else if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`  ${key}: ${value}`);
    } else if (typeof value === "object") {
      const json = JSON.stringify(value, null, 2);
      lines.push(`  ${key}:`);
      lines.push(indent(json, 4));
    }
  }

  if (lines.length === 0) return "{}\n";
  return `{\n${lines.join("\n")}\n}\n`;
}

function truncateOneline(text: string): string {
  const oneline = text.replace(/\s+/g, " ").trim();
  if (oneline.length > 300) {
    return oneline.slice(0, 300) + "...";
  }
  return oneline;
}

function indent(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((line) => pad + line).join("\n");
}
