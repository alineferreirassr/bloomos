import type { JourneyBlocker, JourneyRisk, JourneySubjectType } from "@/types/clientJourney";
import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeType } from "@/types/knowledgeGraph";

/**
 * v2.0 Checkpoint 32 — Executive/Operational Integration (Step 23). Pure
 * translation from this checkpoint's own Blockers/Risks into the
 * existing `OperationalRecommendation` shape Business Health/Executive
 * Decisions already consume — the exact seam Route Optimization (30) and
 * every checkpoint since established (`routeFindingsToRecommendations`),
 * never a parallel recommendation or decision engine of Journey's own.
 */

const SEVERITY_MAP: Record<JourneyBlocker["severity"], RecommendationSeverity> = {
  critical: "critical",
  high: "warning",
  medium: "warning",
  low: "info",
  informational: "info",
};

function subjectNodeType(subjectType: JourneySubjectType): KnowledgeNodeType {
  return subjectType;
}

export function journeyBlockersToRecommendations(blockers: JourneyBlocker[], subjectType: JourneySubjectType, subjectId: string): OperationalRecommendation[] {
  return blockers.map((b) => ({
    ruleId: `client_journey.blocker.${b.type}`,
    message: b.description,
    severity: SEVERITY_MAP[b.severity],
    node: { nodeType: subjectNodeType(subjectType), nodeId: subjectId },
  }));
}

export function journeyRisksToRecommendations(risks: JourneyRisk[], subjectType: JourneySubjectType, subjectId: string): OperationalRecommendation[] {
  return risks.map((r) => ({
    ruleId: `client_journey.risk.${r.type}`,
    message: r.description,
    severity: SEVERITY_MAP[r.severity],
    node: { nodeType: subjectNodeType(subjectType), nodeId: subjectId },
  }));
}
