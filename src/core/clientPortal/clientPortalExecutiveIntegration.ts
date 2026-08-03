import type { RecommendationSeverity, OperationalRecommendation } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";

/**
 * Checkpoint 36, Step 15 — Executive Decisions Integration. Pure
 * translation of a signal the client raised through the Portal (Step 3's
 * "Request Revision" on a Proposal) into the exact
 * `proposalHealthToRecommendations` seam
 * (`core/proposalPlatform/proposalExecutiveIntegration.ts`) — never a
 * second recommendation or decision engine of the Client Portal's own.
 */

const STALE_DAYS = 3;

function recommendation(ruleId: string, message: string, severity: RecommendationSeverity, node: KnowledgeNodeRef): OperationalRecommendation {
  return { ruleId, message, severity, node };
}

function daysBetween(a: string, b: string): number {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

export interface ClientPortalRevisionRequestContext {
  proposalId: string;
  clientName: string;
  revisionRequestedAt: string;
  now: string;
}

export function clientPortalRevisionRequestToRecommendations(context: ClientPortalRevisionRequestContext): OperationalRecommendation[] {
  const node: KnowledgeNodeRef = { nodeType: "proposal", nodeId: context.proposalId };
  const days = Math.floor(daysBetween(context.revisionRequestedAt, context.now));
  const severity: RecommendationSeverity = days >= STALE_DAYS ? "critical" : "warning";
  return [
    recommendation(
      "client_portal.revision_request_waiting",
      `${context.clientName} requested a proposal revision ${days} day(s) ago through the Client Portal — it hasn't been resent yet.`,
      severity,
      node,
    ),
  ];
}
