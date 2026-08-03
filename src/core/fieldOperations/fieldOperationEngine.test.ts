import { describe, expect, it } from "vitest";
import { evaluateFieldOperationEligibility, isFieldOperationArchived } from "@/core/fieldOperations/fieldOperationEngine";

describe("fieldOperationEngine", () => {
  it("allows building when the assignment is accepted and the package is approved", () => {
    expect(evaluateFieldOperationEligibility({ assignmentQueueState: "accepted", packageStatus: "approved" })).toEqual({ canBuild: true, reason: null });
  });

  it("rejects when the assignment has not been accepted", () => {
    const result = evaluateFieldOperationEligibility({ assignmentQueueState: "pending", packageStatus: "approved" });
    expect(result.canBuild).toBe(false);
    expect(result.reason).toContain("not been accepted");
  });

  it("rejects when the package is not approved", () => {
    const result = evaluateFieldOperationEligibility({ assignmentQueueState: "accepted", packageStatus: "draft" });
    expect(result.canBuild).toBe(false);
    expect(result.reason).toContain("not been approved");
  });

  it("identifies archived status", () => {
    expect(isFieldOperationArchived("archived")).toBe(true);
    expect(isFieldOperationArchived("active")).toBe(false);
    expect(isFieldOperationArchived("completed")).toBe(false);
  });
});
