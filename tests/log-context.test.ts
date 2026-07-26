import { describe, expect, it } from "vitest";
import { formatContextLog } from "../src/core/context/log-context.js";

describe("formatContextLog", () => {
  it("writes a parseable context object as one log line", () => {
    const context = { issue: 42, title: "A long title" };

    const line = formatContextLog(context);

    expect(line).toBe('{"issue":42,"title":"A long title"}\n');
    expect(JSON.parse(line)).toEqual(context);
  });
});
