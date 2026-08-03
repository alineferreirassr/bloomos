import type { ApprovalRequirement } from "@/types/operationalPlanning";

/** v2.0 Checkpoint 27.2, Step 10 — Approval Engine. Requirements only, per the spec: this file tracks who/what must approve a plan/phase/step/milestone before it can proceed, never automates or grants an approval itself. `automatic_rule_placeholder` is a real `ApprovalType` value with no automation behind it — a disclosed placeholder for a future rule engine, not a live automatic-approval path. */

export function pendingApprovals(approvals: ApprovalRequirement[]): ApprovalRequirement[] {
  return approvals.filter((a) => a.status === "pending");
}

export function rejectedApprovals(approvals: ApprovalRequirement[]): ApprovalRequirement[] {
  return approvals.filter((a) => a.status === "rejected");
}

/** Vacuous 100%-equivalent (`ratio: 1`) for a plan with zero approval requirements. */
export function approvalCompletionRatio(approvals: ApprovalRequirement[]): number {
  if (approvals.length === 0) return 1;
  return approvals.filter((a) => a.status === "approved").length / approvals.length;
}

/** A simple, disclosed threshold — `pendingCount >= thresholdCount` pending approvals at once is surfaced as a bottleneck. Never a queueing/SLA analysis. */
export function hasApprovalBottleneck(approvals: ApprovalRequirement[], thresholdCount = 3): boolean {
  return pendingApprovals(approvals).length >= thresholdCount;
}
