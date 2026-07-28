import type { OpencodeContext } from "./types.js";

/**
 * Parse the JSONL stdout stream from `opencode run --format json`.
 *
 * Each line is a JSON object with a `type` field. The parser extracts:
 * - step_start: session ID, message ID, git snapshot
 * - tool_use: tool name, accumulated count
 * - text: last text before step_finish with reason=stop (Option B)
 * - step_finish: tokens, cost (accumulated across all steps), final git snapshot
 * - error: error name and message
 *
 * Returns null if the input is not valid JSONL with a `type` field.
 */
export function parseOpencodeJsonOutput(stdout: string): OpencodeContext | null {
  const lines = stdout.trim().split("\n").filter((l) => l.trim());

  if (lines.length === 0) return null;

  // Verify first line is valid JSON with a `type` field
  let firstParsed: unknown;
  try {
    firstParsed = JSON.parse(lines[0]);
  } catch {
    return null;
  }

  if (typeof firstParsed !== "object" || firstParsed === null || !("type" in firstParsed)) {
    return null;
  }

  const result: OpencodeContext = {
    session: { id: "", messageId: "" },
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    cost: 0,
    tools: { count: 0, names: [] },
    gitSnapshot: "",
    error: null,
    text: null,
  };

  let lastTextBeforeStop: string | null = null;
  let sawStepFinishStop = false;

  for (const line of lines) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }

    const type = event.type as string;
    const part = event.part as Record<string, unknown> | undefined;

    switch (type) {
      case "step_start": {
        if (event.sessionID) {
          result.session.id = event.sessionID as string;
        }
        if (part?.messageID) {
          result.session.messageId = part.messageID as string;
        }
        if (part?.snapshot) {
          result.gitSnapshot = part.snapshot as string;
        }
        break;
      }

      case "tool_use": {
        result.tools.count++;
        const toolName = part?.tool as string | undefined;
        if (toolName && !result.tools.names.includes(toolName)) {
          result.tools.names.push(toolName);
        }
        break;
      }

      case "text": {
        // Track text events; we'll capture the last one before step_finish(reason=stop)
        const textContent = part?.text as string | undefined;
        if (textContent) {
          lastTextBeforeStop = textContent;
        }
        break;
      }

      case "step_finish": {
        if (part?.reason === "stop") {
          sawStepFinishStop = true;
          // Capture the text accumulated so far
          result.text = lastTextBeforeStop;
          lastTextBeforeStop = null;
        }

        // Accumulate tokens and cost
        const tokens = part?.tokens as Record<string, unknown> | undefined;
        if (tokens) {
          if (typeof tokens.input === "number") result.tokens.input += tokens.input;
          if (typeof tokens.output === "number") result.tokens.output += tokens.output;
          if (typeof tokens.reasoning === "number") result.tokens.reasoning += tokens.reasoning;
          const cache = tokens.cache as Record<string, unknown> | undefined;
          if (cache) {
            if (typeof cache.read === "number") result.tokens.cache.read += cache.read;
            if (typeof cache.write === "number") result.tokens.cache.write += cache.write;
          }
        }

        if (typeof part?.cost === "number") {
          result.cost += part.cost;
        }

        if (part?.snapshot) {
          result.gitSnapshot = part.snapshot as string;
        }
        break;
      }

      case "error": {
        const error = event.error as Record<string, unknown> | undefined;
        if (error) {
          const name = error.name as string | undefined;
          const data = error.data as Record<string, unknown> | undefined;
          result.error = {
            name: name ?? "UnknownError",
            message: (data?.message as string) ?? "Unknown error",
          };
        }
        break;
      }
    }
  }

  // If we never saw a step_finish with reason=stop, don't set text
  if (!sawStepFinishStop) {
    result.text = null;
  }

  return result;
}
