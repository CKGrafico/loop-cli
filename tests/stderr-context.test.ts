import { describe, it, expect } from "vitest";
import { mergeCommandOutput, parseStdout } from "../src/core/context/context-parser.js";
import type { ExecutionResult } from "../src/types.js";

function parseWithStderr(stdout: string, stderr: string): Record<string, unknown> | null {
  const context: Record<string, unknown> = {};
  mergeCommandOutput(context, stdout, stderr);
  return Object.keys(context).length === 0 ? null : context;
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

  it("preserves JSON fields and captures stdout and stderr as output", () => {
    const result = parseWithStderr('{"number": 123}', "some warning");

    expect(result).toEqual({
      number: 123,
      output: '{"number": 123}\nsome warning',
    });
  });

  it("keeps existing structured context while replacing output with latest command output", () => {
    const context: Record<string, unknown> = {
      number: 122,
      title: "Issue title",
      body: "Issue body",
      output: "previous output",
    };

    mergeCommandOutput(context, "implementation logs", "");

    expect(context).toEqual({
      number: 122,
      title: "Issue title",
      body: "Issue body",
      output: "implementation logs",
    });
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
