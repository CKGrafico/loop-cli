export function formatContextLog(context: Record<string, unknown>): string {
  return `${JSON.stringify(context)}\n`;
}
