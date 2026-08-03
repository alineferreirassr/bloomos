import type { FinanceAssistantContext, FinanceAssistantModelOutput, FinanceAssistantModelAction } from "@/modules/ai/financeAssistant/types";

type SemanticResult<T> = { success: true; value: T } | { success: false; error: string };

/**
 * The hard-reject counterpart to Event Operations Brief's own silent-drop
 * pattern — matching Daily Brief/CRM Assistant/Proposal Generator's
 * precedent instead, since the Finance Assistant touches Invoices/Payments/
 * Contracts/amounts the same high-stakes way. Every entity the model
 * references by id (a risk explanation's `riskId`, an action's `targetId`)
 * must already be present in `FinanceAssistantContext`; a single invented
 * reference rejects the whole response rather than silently rendering a
 * partially-trusted one. Free-text fields (`executiveSummary`,
 * `revenueOverviewSummary`, `cashFlowSummary`, action `label`s/`reason`s)
 * carry the same residual narrative risk every other Skill's validator
 * already accepts — this validator only ever checks structured, id-based
 * references, never prose content or amounts.
 */
export function validateFinanceAssistantSemantics(output: FinanceAssistantModelOutput, context: FinanceAssistantContext): SemanticResult<FinanceAssistantModelOutput> {
  const knownRiskIds = new Set(context.financialRisks.map((risk) => risk.riskId));
  const knownInvoiceIds = new Set([...context.outstandingInvoices, ...context.paymentDelays, ...context.upcomingRevenue].map((i) => i.invoiceId));
  const knownContractIds = new Set(context.unsignedContracts.map((c) => c.contractId));
  const knownEventIds = new Set(context.upcomingEvents.map((e) => e.eventId));

  for (const entry of output.financialRiskExplanations) {
    if (!knownRiskIds.has(entry.riskId)) {
      return { success: false, error: "Bloom AI referenced a financial risk that isn't in this Workspace's current data." };
    }
  }

  const idsByType: Record<string, Set<string>> = {
    invoice: knownInvoiceIds,
    contract: knownContractIds,
    event: knownEventIds,
  };

  function validateActions(actions: FinanceAssistantModelAction[]): string | null {
    for (const action of actions) {
      if (action.targetType === null) continue;
      if (!action.targetId) return "Bloom AI suggested an action with a target type but no target.";
      const knownIds = idsByType[action.targetType];
      if (!knownIds?.has(action.targetId)) {
        return "Bloom AI referenced a record that doesn't exist in this Workspace's current data.";
      }
    }
    return null;
  }

  for (const actions of [output.revenueOpportunities, output.recommendations]) {
    const error = validateActions(actions);
    if (error) return { success: false, error };
  }

  return { success: true, value: output };
}
