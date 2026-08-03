import { getEventOperationsData } from "@/modules/operations/eventOperationsData";
import { OPERATIONS_HEALTH_BAND_LABELS, PACKING_CATEGORY_LABELS } from "@/core/operations/types";

export interface OperationsBrief {
  riskSummary: string;
  budgetInsight: string;
  packingSuggestion: string;
  timelineImprovement: string;
  vendorRecommendation: string;
  teamRecommendation: string;
  operationalBrief: string;
}

/**
 * Bloom AI Operations (v2 Checkpoint 21, Step 15) — the Copilot's own
 * per-event operational brief. Every sentence here is a deterministic
 * template over `getEventOperationsData()`'s own already-computed engine
 * outputs (RiskEngine, BudgetEngine, PackingEngine, TimelineEngine) —
 * never a new computation, and never a real generative AI call, matching
 * this checkpoint's stop condition. Reuses the exact "reuse, never
 * duplicate" pattern `eventAssistant.ts` (Checkpoint 20) already
 * established for per-Event Copilot cards.
 */
export async function generateOperationsBrief(eventId: string): Promise<OperationsBrief> {
  const data = await getEventOperationsData(eventId);

  const riskSummary =
    data.risks.length === 0
      ? "No operational risks detected for this event right now."
      : `${data.risks.length} operational risk${data.risks.length === 1 ? "" : "s"} detected — most urgent: ${data.risks[0].message}`;

  const budgetInsight =
    data.budget.estimatedCostMinor === 0
      ? "No estimated budget on file yet for this event."
      : data.budget.forecastNote;

  const unfulfilledCount = data.packingGroups.reduce((sum, group) => sum + group.items.filter((item) => item.source === "shopping").length, 0);
  const packingSuggestion =
    data.packingGroups.length === 0
      ? "No packing list generated yet — assign Services with inventory requirements."
      : unfulfilledCount > 0
        ? `${unfulfilledCount} item${unfulfilledCount === 1 ? "" : "s"} still need sourcing across ${data.packingGroups.map((g) => PACKING_CATEGORY_LABELS[g.category]).join(", ")}.`
        : "Every packing list item is already matched to inventory in stock.";

  const timelineImprovement =
    data.timeline.length === 0
      ? "No operational milestones recorded yet — logging Live Event Mode actions will build this out."
      : `${data.timeline.length} milestone${data.timeline.length === 1 ? "" : "s"} recorded so far, most recently "${data.timeline[data.timeline.length - 1].title}."`;

  const unassignedVendors = data.vendorAssignments.filter((a) => a.assignment.status !== "confirmed").length;
  const vendorRecommendation =
    data.vendorAssignments.length === 0
      ? "No vendor requirements for this event's assigned Services."
      : unassignedVendors > 0
        ? `${unassignedVendors} vendor requirement${unassignedVendors === 1 ? "" : "s"} still need confirming.`
        : "All vendor requirements are confirmed.";

  const unassignedTeam = data.teamRequirements.filter((r) => r.member === null).length;
  const teamRecommendation =
    data.teamRequirements.length === 0
      ? "No team roles required for this event's assigned Services."
      : unassignedTeam > 0
        ? `${unassignedTeam} team role${unassignedTeam === 1 ? "" : "s"} still need assigning.`
        : "All required team roles are assigned.";

  const operationalBrief = `This event is currently ${OPERATIONS_HEALTH_BAND_LABELS[data.health.band]} (${data.health.score}/100). ${riskSummary} ${budgetInsight}`;

  return { riskSummary, budgetInsight, packingSuggestion, timelineImprovement, vendorRecommendation, teamRecommendation, operationalBrief };
}
