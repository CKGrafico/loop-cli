import { describe, it, expect } from "vitest";
import { parseStdout } from "../src/core/context/context-parser.js";
import type { ExecutionResult } from "../src/types.js";

// Mirrors the combine-then-parse logic in run-executor.ts and chain-executor.ts.
// When stdout is empty or non-JSON, stderr is appended so the {{output}} context
// key carries error messages to the next task.
function parseWithStderr(stdout: string, stderr: string): Record<string, unknown> | null {
  let parsed = parseStdout(stdout);
  if (parsed === null || parsed.output) {
    const combined = stderr
      ? (stdout ? stdout + "\n" + stderr : stderr)
      : stdout;
    const combinedParsed = parseStdout(combined);
    if (combinedParsed !== null) {
      parsed = combinedParsed;
    }
  }
  return parsed;
}

describe("stderr capture into output context", () => {
  it("combines plain-text stdout and stderr under output key", () => {
    expect(parseStdout("stdout_line\nstderr_line")).toEqual({
      output: "stdout_line\nstderr_line",
    });
  });

  it("uses stderr alone when stdout is empty", () => {
    expect(parseWithStderr("", "stderr_line")).toEqual({
      output: "stderr_line",
    });
  });

  it("ignores stderr when stdout is valid JSON", () => {
    const result = parseWithStderr('{"number": 123}', "some warning");

    expect(result).toEqual({ number: 123 });
    expect(result).not.toHaveProperty("output");
  });

  it("ExecutionResult accepts an optional stderr field", () => {
    const result: ExecutionResult = {
      exitCode: 0,
      duration: 100,
      startedAt: new Date(),
      endedAt: new Date(),
      stdout: "ok",
      stderr: "warning",
    };

    expect(result.stderr).toBe("warning");
  });

  it("ExecutionResult allows stderr to be omitted", () => {
    const result: ExecutionResult = {
      exitCode: 1,
      duration: 50,
      startedAt: new Date(),
      endedAt: new Date(),
    };

    expect(result.stderr).toBeUndefined();
  });
});
