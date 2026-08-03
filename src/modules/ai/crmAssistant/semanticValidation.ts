import type { CrmAssistantContext, CRMAssistantModelOutput, CrmAssistantModelAction } from "@/modules/ai/crmAssistant/types";

type SemanticResult<T> = { success: true; value: T } | { success: false; error: string };

/**
 * The hard-reject counterpart to Event Operations Brief's own silent-drop
 * pattern — matching Daily Brief/Proposal Generator's precedent instead,
 * since the CRM Assistant touches Clients/Leads/Contracts/Invoices the same
 * high-stakes way. Every entity the model references by id (a risk
 * explanation's `clientId`, an action's `targetId`) must already be present
 * in `CrmAssistantContext`; a single invented reference rejects the whole
 * response rather than silently rendering a partially-trusted one. Free-text
 * fields (`executiveSummary`, `relationshipHealthSummary`, action `label`s/
 * `reason`s) carry the same residual narrative risk every other Skill's
 * validator already accepts — this validator only ever checks structured,
 * id-based references, never prose content.
 */
export function validateCrmAssistantSemantics(output: CRMAssistantModelOutput, context: CrmAssistantContext): SemanticResult<CRMAssistantModelOutput> {
  const knownClientIds = new Set([
    ...context.priorityClients.map((c) => c.clientId),
    ...context.inactiveClients.map((c) => c.clientId),
    ...context.clientsAtRisk.map((r) => r.clientId),
  ]);
  const knownLeadIds = new Set(context.activeLeads.map((l) => l.leadId));
  const knownEventIds = new Set([...context.upcomingEvents, ...context.pastEvents].map((e) => e.eventId));
  const knownContractIds = new Set(context.unsignedContracts.map((c) => c.contractId));
  const knownInvoiceIds = new Set(context.outstandingInvoices.map((i) => i.invoiceId));
  const knownAtRiskClientIds = new Set(context.clientsAtRisk.map((r) => r.clientId));

  for (const entry of output.clientRiskExplanations) {
    if (!knownAtRiskClientIds.has(entry.clientId)) {
      return { success: false, error: "Bloom AI referenced a Client who isn't in this Workspace's current at-risk list." };
    }
  }

  const idsByType: Record<string, Set<string>> = {
    client: knownClientIds,
    lead: knownLeadIds,
    event: knownEventIds,
    contract: knownContractIds,
    invoice: knownInvoiceIds,
  };

  function validateActions(actions: CrmAssistantModelAction[]): string | null {
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

  for (const actions of [output.upcomingOpportunities, output.suggestedFollowUps, output.recommendedActions]) {
    const error = validateActions(actions);
    if (error) return { success: false, error };
  }

  return { success: true, value: output };
}
