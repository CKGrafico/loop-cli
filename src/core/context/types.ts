/**
 * Structured context object populated from `opencode run --format json` JSONL output.
 * Made available to subsequent tasks in the same loop chain as `context.opencode.*`.
 */
export interface OpencodeContext {
  /** Session information from step_start event */
  session: {
    /** OpenCode session ID (e.g., "ses_abc123") — use with --session to chain tasks */
    id: string;
    /** Message ID from the step_start event */
    messageId: string;
  };
  /** Token usage accumulated across all step_finish events */
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
  /** Total cost in USD accumulated across all step_finish events */
  cost: number;
  /** Tool usage statistics from tool_use events */
  tools: {
    count: number;
    names: string[];
  };
  /** Git snapshot hash from the final step_finish event */
  gitSnapshot: string;
  /** Error information if an error event was emitted, null otherwise */
  error: {
    name: string;
    message: string;
  } | null;
  /** Last text event before step_finish with reason=stop (agent's final summary). Option B. */
  text: string | null;
  model: string | null;
}
