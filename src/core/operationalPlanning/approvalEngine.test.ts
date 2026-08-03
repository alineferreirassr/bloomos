import { describe, expect, it } from "vitest";
import { pendingApprovals, rejectedApprovals, approvalCompletionRatio, hasApprovalBottleneck } from "@/core/operationalPlanning/approvalEngine";
import type { ApprovalRequirement, ApprovalStatus } from "@/types/operationalPlanning";

function makeApproval(id: string, status: ApprovalStatus): ApprovalRequirement {
  return { id, type: "manager", description: "Manager sign-off", phase_id: null, step_id: null, milestone_id: null, status, approved_by: null, approved_at: null };
}

describe("pendingApprovals / rejectedApprovals", () => {
  it("filters by status", () => {
    const approvals = [makeApproval("a1", "pending"), makeApproval("a2", "approved"), makeApproval("a3", "rejected")];
    expect(pendingApprovals(approvals).map((a) => a.id)).toEqual(["a1"]);
    expect(rejectedApprovals(approvals).map((a) => a.id)).toEqual(["a3"]);
  });
});

describe("approvalCompletionRatio", () => {
  it("is vacuous (ratio 1) for zero approvals", () => {
    expect(approvalCompletionRatio([])).toBe(1);
  });

  it("computes the approved ratio", () => {
    expect(approvalCompletionRatio([makeApproval("a1", "approved"), makeApproval("a2", "pending")])).toBe(0.5);
  });
});

describe("hasApprovalBottleneck", () => {
  it("is false below the threshold and true at/above it", () => {
    const twoPending = [makeApproval("a1", "pending"), makeApproval("a2", "pending")];
    expect(hasApprovalBottleneck(twoPending, 3)).toBe(false);
    const threePending = [...twoPending, makeApproval("a3", "pending")];
    expect(hasApprovalBottleneck(threePending, 3)).toBe(true);
  });
});
