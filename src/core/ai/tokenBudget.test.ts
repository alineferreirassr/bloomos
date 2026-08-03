import { describe, expect, it } from "vitest";
import { estimateTokens, applyTokenBudget } from "@/core/ai/tokenBudget";

describe("estimateTokens", () => {
  it("returns 0 for empty text", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("estimates roughly 4 characters per token, rounded up", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});

describe("applyTokenBudget", () => {
  it("keeps every section when the budget comfortably fits", () => {
    const result = applyTokenBudget({ a: "short", b: "also short" }, { maxInputTokens: 1000, reservedOutputTokens: 0 });
    expect(result.truncated).toBe(false);
    expect(result.omittedSections).toEqual([]);
    expect(result.content).toEqual({ a: "short", b: "also short" });
  });

  it("drops lower-priority sections first when the budget is tight", () => {
    const bigString = "x".repeat(4000); // ~1000 tokens
    const sections = { important: bigString, extra: bigString };
    const result = applyTokenBudget(sections, {
      maxInputTokens: 1200,
      reservedOutputTokens: 0,
      sections: [
        { key: "important", priority: 0 },
        { key: "extra", priority: 1 },
      ],
    });

    expect(result.truncated).toBe(true);
    expect(result.omittedSections).toEqual(["extra"]);
    expect(result.content).toHaveProperty("important");
    expect(result.content).not.toHaveProperty("extra");
  });

  it("respects reservedOutputTokens by shrinking the effective input budget", () => {
    const text = "x".repeat(400); // ~100 tokens
    const result = applyTokenBudget({ only: text }, { maxInputTokens: 100, reservedOutputTokens: 50 });
    expect(result.truncated).toBe(true);
    expect(result.omittedSections).toEqual(["only"]);
  });

  it("falls back to input order when no explicit section priority is given", () => {
    const bigString = "x".repeat(4000);
    const result = applyTokenBudget({ first: bigString, second: bigString }, { maxInputTokens: 1200, reservedOutputTokens: 0 });
    expect(result.content).toHaveProperty("first");
    expect(result.omittedSections).toEqual(["second"]);
  });

  it("never lets the effective budget go negative when reservedOutputTokens exceeds maxInputTokens", () => {
    const result = applyTokenBudget({ only: "abcd" }, { maxInputTokens: 10, reservedOutputTokens: 50 });
    expect(result.truncated).toBe(true);
    expect(result.content).toEqual({});
  });
});
