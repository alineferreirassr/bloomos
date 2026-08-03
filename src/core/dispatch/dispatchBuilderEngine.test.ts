import { describe, expect, it } from "vitest";
import { evaluateDispatchEligibility } from "@/core/dispatch/dispatchBuilderEngine";

describe("evaluateDispatchEligibility", () => {
  it("allows dispatch when the package is approved and ready", () => {
    expect(evaluateDispatchEligibility({ packageStatus: "approved", packageReadinessState: "ready" })).toEqual({ canDispatch: true, reason: null });
  });

  it("rejects an unapproved package regardless of readiness", () => {
    const result = evaluateDispatchEligibility({ packageStatus: "draft", packageReadinessState: "ready" });
    expect(result.canDispatch).toBe(false);
    expect(result.reason).toContain("not been approved");
  });

  it("rejects an approved package that isn't ready", () => {
    const result = evaluateDispatchEligibility({ packageStatus: "approved", packageReadinessState: "waiting_resources" });
    expect(result.canDispatch).toBe(false);
    expect(result.reason).toContain("waiting resources");
  });
});
