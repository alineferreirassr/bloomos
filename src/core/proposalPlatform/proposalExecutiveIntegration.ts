import type { RecommendationSeverity, OperationalRecommendation } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { ProposalHealth, ProposalReadinessResult } from "@/types/proposalPlatform";
import type { ProposalDraft } from "@/types/proposal";

/**
 * v2.0 Checkpoint 33 — Executive Decisions Integration (Step 16). Pure
 * translation, the exact `journeyBlockersToRecommendations` seam
 * (`core/clientJourney/journeyExecutiveIntegration.ts`, Checkpoint 32) —
 * never a second recommendation or decision engine of the Proposal
 * Platform's own.
 */

const STALLED_DAYS = 5;
const EXPIRING_DAYS = 30;
const HIGH_VALUE_MINOR = 500_00;

function recommendation(ruleId: string, message: string, severity: RecommendationSeverity, node: KnowledgeNodeRef): OperationalRecommendation {
  return { ruleId, message, severity, node };
}

export interface ProposalExecutiveContext {
  proposal: ProposalDraft;
  readiness: ProposalReadinessResult;
  health: ProposalHealth;
  grandTotal_minor: number | null;
  documentStatus: "draft" | "revision" | "published" | "archived";
  sentAt: string | null;
  updatedAt: string;
  now: string;
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export function proposalHealthToRecommendations(context: ProposalExecutiveContext): OperationalRecommendation[] {
  const node: KnowledgeNodeRef = { nodeType: "proposal", nodeId: context.proposal.id };
  const recs: OperationalRecommendation[] = [];

  if (context.readiness.canSend) {
    recs.push(recommendation("proposal_platform.ready_to_send", `Proposal is ready to send (health ${context.health.overallScore}).`, "info", node));
  } else if (context.readiness.state === "missing_pricing") {
    recs.push(recommendation("proposal_platform.missing_pricing", context.readiness.reasons[0] ?? "Proposal is missing pricing.", "warning", node));
  } else if (context.readiness.state === "needs_review" || context.readiness.state === "missing_approval") {
    recs.push(recommendation("proposal_platform.needs_review", context.readiness.reasons[0] ?? "Proposal needs review.", "warning", node));
  }

  if (context.documentStatus === "archived") {
    recs.push(recommendation("proposal_platform.archived", "Proposal has been archived.", "info", node));
  }

  if (context.documentStatus !== "archived" && daysBetween(context.updatedAt, context.now) >= STALLED_DAYS && context.proposal.status === "draft") {
    recs.push(recommendation("proposal_platform.stalled", `Proposal has had no activity in ${Math.floor(daysBetween(context.updatedAt, context.now))} day(s).`, "warning", node));
  }

  if (context.sentAt && daysBetween(context.sentAt, context.now) >= EXPIRING_DAYS && context.proposal.status === "draft") {
    recs.push(recommendation("proposal_platform.expiring", `Proposal was sent ${Math.floor(daysBetween(context.sentAt, context.now))} day(s) ago and has not been decided.`, "warning", node));
  }

  if (context.grandTotal_minor !== null && context.grandTotal_minor >= HIGH_VALUE_MINOR && context.proposal.status === "draft" && context.sentAt) {
    recs.push(recommendation("proposal_platform.high_value_waiting", `A high-value proposal (${(context.grandTotal_minor / 100).toFixed(2)}) is awaiting a decision.`, "critical", node));
  }

  return recs;
}
