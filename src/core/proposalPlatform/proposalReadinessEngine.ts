import type { ProposalDraft } from "@/types/proposal";
import type { ProposalHealth, ProposalReadinessResult, ProposalReadinessState, ProposalVersion } from "@/types/proposalPlatform";

/**
 * v2.0 Checkpoint 33 — Proposal Readiness (Step 11). A waterfall over
 * already-computed facts — the same "first unmet requirement wins" shape
 * `ExecutionPackage`'s own `PACKAGE_READINESS_STATES` established — never a
 * second scoring pass over Health's own categories. `missing_approval`
 * reuses `ProposalDraft.reviewed_by` (a human has reviewed the underlying
 * AI-generated content) as its real signal — disclosed, since no separate
 * "document approval" concept exists elsewhere in this codebase.
 */

const READY_HEALTH_THRESHOLD = 70;

export interface EvaluateProposalReadinessInput {
  proposal: ProposalDraft;
  currentVersion: ProposalVersion | null;
  hasClient: boolean;
  requiredSectionKeys: string[];
  health: ProposalHealth;
}

export function evaluateProposalReadiness(input: EvaluateProposalReadinessInput): ProposalReadinessResult {
  const snapshot = input.currentVersion?.snapshot ?? null;

  const rules: Array<[boolean, ProposalReadinessState, string]> = [
    [!input.hasClient, "missing_client", "This proposal has no linked client record."],
    [snapshot === null, "missing_sections", "No proposal document has been built yet."],
    [snapshot !== null && snapshot.packageIds.length === 0, "missing_package", "No package has been selected."],
    [snapshot !== null && (snapshot.pricing.lineItems.length === 0 || snapshot.pricing.grandTotal_minor <= 0), "missing_pricing", "Pricing has not been configured."],
    [snapshot !== null && input.requiredSectionKeys.some((k) => !snapshot.sections.some((s) => s.key === (k as never))), "missing_sections", "One or more required sections are missing."],
    [snapshot !== null && snapshot.terms.trim().length === 0, "missing_terms", "Terms have not been written."],
    [input.proposal.reviewed_by === null, "missing_approval", "No one has reviewed this proposal's content yet."],
    [input.health.overallScore < READY_HEALTH_THRESHOLD, "needs_review", `Overall proposal health (${input.health.overallScore}) is below the ${READY_HEALTH_THRESHOLD} threshold.`],
  ];

  for (const [triggered, state, reason] of rules) {
    if (triggered) return { state, reasons: [reason], canSend: false };
  }

  return { state: "ready", reasons: [], canSend: true };
}
