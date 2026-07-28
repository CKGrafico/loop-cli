import type { AgentTelemetryIntegration } from "./agent-integration.js";
import type {
  CommandInvocation,
  PreparedCommandInvocation,
  ChildTelemetryContext,
  AgentUsage,
  CommandResult,
} from "../telemetry-types.js";

const CLAUDE_BINARIES = ["claude"];

/**
 * Detects `claude -p ...` or `claude --print ...` invocations and
 * enables Claude Code's native telemetry, routing to loop-task's endpoint.
 *
 * Claude Code does not support a persistent serve model with `--attach`
 * equivalent. All telemetry env is injected per-task as fallback.
 * When Claude Code adds serve-attach support, implement the serve
 * lifecycle methods (ensureServe, isServeAlive, prepareRunArgs,
 * shutdownServe) here.
 */
export class ClaudeCodeTelemetryIntegration implements AgentTelemetryIntegration {
  readonly id = "claude-code";

  matches(command: string, args: string[]): boolean {
    const basename = command.split("/").pop()?.replace(/\.exe$/, "").toLowerCase() ?? "";
    if (!CLAUDE_BINARIES.includes(basename)) return false;
    // Must have -p or --print flag
    return args.includes("-p") || args.includes("--print");
  }

  prepare(
    invocation: CommandInvocation,
    _context: ChildTelemetryContext,
  ): PreparedCommandInvocation {
    const env: Record<string, string> = { ...invocation.env };

    // Enable Claude Code's telemetry
    env.CLAUDE_CODE_ENABLE_TELEMETRY = "1";

    // The standard OTEL_* env vars are already set by the adapter's
    // prepareChildProcess. Claude Code reads these natively.

    return { command: invocation.command, args: [...invocation.args], env };
  }

  parseUsage(result: CommandResult): AgentUsage | undefined {
    if (!result.stdout) return undefined;

    try {
      // Claude Code may output JSON with usage info
      // Try to find JSON in the output
      const jsonMatch = result.stdout.match(/\{[\s\S]*"usage"[\s\S]*\}/);
      if (!jsonMatch) return undefined;

      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed !== "object" || parsed === null) return undefined;

      const usageData = parsed.usage ?? parsed;
      const usage: AgentUsage = {};

      if (typeof usageData.input_tokens === "number") usage.inputTokens = usageData.input_tokens;
      if (typeof usageData.output_tokens === "number") usage.outputTokens = usageData.output_tokens;
      if (typeof usageData.cache_read_input_tokens === "number") usage.cacheReadTokens = usageData.cache_read_input_tokens;
      if (typeof usageData.cache_creation_input_tokens === "number") usage.cacheWriteTokens = usageData.cache_creation_input_tokens;

      if (Object.keys(usage).length === 0) return undefined;
      return usage;
    } catch {
      return undefined;
    }
  }
}
