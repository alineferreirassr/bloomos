import type { RecommendationSeverity, OperationalRecommendation } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { Contract, ContractDocumentStatus, ContractHealth, ContractReadinessResult } from "@/types/contractPlatform";

/**
 * v2.0 Checkpoint 34 — Executive Decisions Integration (Step 15). Pure
 * translation, the exact `proposalHealthToRecommendations` seam
 * (`core/proposalPlatform/proposalExecutiveIntegration.ts`, Checkpoint 33)
 * — never a second recommendation or decision engine of the Contract
 * Platform's own. 6 named rules: 5 evaluate one contract's own document
 * (ready to publish / missing requirements / needs review / archived /
 * stalled draft); the 6th, `contract_platform.proposal_missing_contract`,
 * is the spec's own cross-workspace check — it evaluates an ACCEPTED
 * Proposal, not a Contract, flagging when no contract document has been
 * started for it yet. It lives here (not in the Proposal Platform) since
 * this is the checkpoint that owns "a contract should exist."
 */

const STALLED_DAYS = 5;

function recommendation(ruleId: string, message: string, severity: RecommendationSeverity, node: KnowledgeNodeRef): OperationalRecommendation {
  return { ruleId, message, severity, node };
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export interface ContractExecutiveContext {
  contract: Contract;
  readiness: ContractReadinessResult;
  health: ContractHealth;
  documentStatus: ContractDocumentStatus | null;
  updatedAt: string | null;
  now: string;
}

export function contractHealthToRecommendations(context: ContractExecutiveContext): OperationalRecommendation[] {
  const node: KnowledgeNodeRef = { nodeType: "contract", nodeId: context.contract.id };
  const recs: OperationalRecommendation[] = [];

  if (context.readiness.canPublish) {
    recs.push(recommendation("contract_platform.ready_to_publish", `Contract document is ready to publish (health ${context.health.overallScore}).`, "info", node));
  } else if (["missing_client", "missing_proposal", "missing_sections", "missing_clauses", "missing_variables"].includes(context.readiness.state)) {
    recs.push(recommendation("contract_platform.missing_requirements", context.readiness.reasons[0] ?? "Contract document is missing required content.", "warning", node));
  } else if (context.readiness.state === "needs_review" || context.readiness.state === "needs_approval") {
    recs.push(recommendation("contract_platform.needs_review", context.readiness.reasons[0] ?? "Contract document needs review.", "warning", node));
  }

  if (context.documentStatus === "archived") {
    recs.push(recommendation("contract_platform.archived", "Contract document has been archived.", "info", node));
  }

  if (context.documentStatus === "draft" && context.updatedAt && daysBetween(context.updatedAt, context.now) >= STALLED_DAYS) {
    recs.push(recommendation("contract_platform.stalled", `Contract document has had no activity in ${Math.floor(daysBetween(context.updatedAt, context.now))} day(s).`, "warning", node));
  }

  return recs;
}

/** The 6th named rule — cross-workspace, evaluated against an accepted Proposal rather than a Contract. `hasContractDocument` is resolved by the caller (a linked Contract with at least one built version). */
export function acceptedProposalMissingContractRecommendation(proposalId: string, proposalStatus: string, hasContractDocument: boolean): OperationalRecommendation | null {
  if (proposalStatus !== "accepted" || hasContractDocument) return null;
  return recommendation("contract_platform.proposal_missing_contract", "Proposal was accepted but no contract document has been started yet.", "warning", { nodeType: "proposal", nodeId: proposalId });
}
