import { describe, expect, it } from "vitest";
import { clockNow } from "@/core/time/clock";

describe("clockNow", () => {
  it("returns a real Date instance reflecting the current time by default", () => {
    const before = Date.now();
    const result = clockNow();
    const after = Date.now();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});
