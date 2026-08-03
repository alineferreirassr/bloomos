import { describe, expect, it } from "vitest";
import { shouldRemember, defaultApprovalStatusFor, computeDefaultExpiresAt } from "@/core/ai/memory/policies";

describe("shouldRemember", () => {
  it("never remembers a failed execution", () => {
    expect(shouldRemember("failure")).toBe(false);
  });

  it("remembers a successful execution", () => {
    expect(shouldRemember("success")).toBe(true);
  });

  it("remembers a write with no execution status at all (a human- or system-authored entry, not tied to any Skill run)", () => {
    expect(shouldRemember(null)).toBe(true);
  });
});

describe("defaultApprovalStatusFor", () => {
  it("a Skill's own free-text suggestion always starts proposed, awaiting human review", () => {
    expect(defaultApprovalStatusFor("skill")).toBe("proposed");
  });

  it("a deterministic system snapshot needs no review — approved directly", () => {
    expect(defaultApprovalStatusFor("system")).toBe("approved");
  });

  it("a human-authored entry needs no review — approved directly", () => {
    expect(defaultApprovalStatusFor("human")).toBe("approved");
  });
});

describe("computeDefaultExpiresAt", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("expires a low-importance memory in 30 days", () => {
    expect(computeDefaultExpiresAt("low", now)).toBe("2026-01-31T00:00:00.000Z");
  });

  it("expires a medium-importance memory in 90 days", () => {
    expect(computeDefaultExpiresAt("medium", now)).toBe("2026-04-01T00:00:00.000Z");
  });

  it("never auto-expires a high-importance memory", () => {
    expect(computeDefaultExpiresAt("high", now)).toBeNull();
  });
});
