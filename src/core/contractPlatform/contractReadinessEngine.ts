import type { ContractHealth, ContractReadinessResult, ContractReadinessState, ContractSectionKey, ContractVersion } from "@/types/contractPlatform";

/**
 * v2.0 Checkpoint 34 — Contract Readiness (Step 9). A waterfall over
 * already-computed facts — the same "first unmet requirement wins" shape
 * `evaluateProposalReadiness` (Checkpoint 33) established. `needs_approval`
 * reuses the document's own real `status === "review"` as its signal (a
 * human explicitly flagged this document for review) — disclosed, since
 * no separate "approval" concept exists on the real `Contract` record
 * for this checkpoint to reuse instead.
 */

const READY_HEALTH_THRESHOLD = 70;

export interface EvaluateContractReadinessInput {
  currentVersion: ContractVersion | null;
  documentStatus: "draft" | "review" | "published" | "archived" | null;
  hasClient: boolean;
  hasLinkedProposal: boolean;
  requiredSectionKeys: ContractSectionKey[];
  requiredClauseKeys: string[];
  presentClauseKeys: string[];
  health: ContractHealth;
}

export function evaluateContractReadiness(input: EvaluateContractReadinessInput): ContractReadinessResult {
  const snapshot = input.currentVersion?.snapshot ?? null;
  const presentClauseSet = new Set(input.presentClauseKeys);
  const presentSectionSet = new Set(snapshot?.sections.map((s) => s.key) ?? []);

  const rules: Array<[boolean, ContractReadinessState, string]> = [
    [!input.hasClient, "missing_client", "This contract has no linked client record."],
    [snapshot === null, "missing_sections", "No contract document has been built yet."],
    [!input.hasLinkedProposal, "missing_proposal", "No Proposal is linked to this contract's event."],
    [snapshot !== null && input.requiredSectionKeys.some((k) => !presentSectionSet.has(k)), "missing_sections", "One or more required sections are missing."],
    [snapshot !== null && input.requiredClauseKeys.some((k) => !presentClauseSet.has(k)), "missing_clauses", "One or more required clauses are missing."],
    [snapshot !== null && input.health.categories.find((c) => c.category === "missing_variables")?.score !== null && (input.health.categories.find((c) => c.category === "missing_variables")?.score ?? 100) < 100, "missing_variables", "One or more variable placeholders have no resolved value."],
    [input.documentStatus === "review", "needs_approval", "This document has been flagged for review and is awaiting approval."],
    [input.health.overallScore < READY_HEALTH_THRESHOLD, "needs_review", `Overall contract health (${input.health.overallScore}) is below the ${READY_HEALTH_THRESHOLD} threshold.`],
  ];

  for (const [triggered, state, reason] of rules) {
    if (triggered) return { state, reasons: [reason], canPublish: false };
  }

  return { state: "ready", reasons: [], canPublish: true };
}
