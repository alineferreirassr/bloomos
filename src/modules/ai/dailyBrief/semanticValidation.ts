import type { DailyOperationsBriefContext, DailyOperationsBriefModelOutput } from "@/modules/ai/dailyBrief/types";

type SemanticResult<T> = { success: true; value: T } | { success: false; error: string };

/**
 * The hard-reject counterpart to Event Operations Brief's own silent-drop
 * pattern — matching Proposal Generator's precedent instead, since Daily
 * Brief now touches payments/contracts/clients the same way a Proposal
 * does. Every entity the model references by id (a risk's `eventId`, a
 * suggested action's `targetId`) must already be present in
 * `DailyOperationsBriefContext`; a single invented reference rejects the
 * whole response rather than silently rendering a partially-trusted one.
 * Free-text fields (`executiveSummary`, `todaysPriorities`,
 * `recommendations`) carry the same residual narrative risk Event
 * Operations Brief's own `reason` field already accepts — this validator
 * only ever checks structured, id-based references, never prose content.
 */
export function validateDailyOperationsBriefSemantics(
  output: DailyOperationsBriefModelOutput,
  context: DailyOperationsBriefContext,
): SemanticResult<DailyOperationsBriefModelOutput> {
  const knownEventIds = new Set([...context.eventsToday, ...context.eventsThisWeek, ...context.eventsAtRisk].map((e) => e.eventId));
  const knownInvoiceIds = new Set(context.latePayments.map((p) => p.invoiceId));
  const knownContractIds = new Set(context.unsignedContracts.map((c) => c.contractId));

  for (const entry of output.riskExplanations) {
    if (!knownEventIds.has(entry.eventId)) {
      return { success: false, error: "Bloom AI referenced an Event that doesn't exist in this Workspace's current data." };
    }
  }

  for (const action of output.suggestedActions) {
    if (action.targetType === null) continue;
    if (!action.targetId) {
      return { success: false, error: "Bloom AI suggested an action with a target type but no target." };
    }
    const knownIds = action.targetType === "event" ? knownEventIds : action.targetType === "invoice" ? knownInvoiceIds : knownContractIds;
    if (!knownIds.has(action.targetId)) {
      return { success: false, error: "Bloom AI referenced a record that doesn't exist in this Workspace's current data." };
    }
  }

  return { success: true, value: output };
}
