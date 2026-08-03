import type {
  CrmAssistantContext,
  CRMAssistantModelOutput,
  CrmAssistantBrief,
  CrmAssistantResolvedAction,
  CrmAssistantResolvedClientRisk,
  CrmAssistantModelAction,
} from "@/modules/ai/crmAssistant/types";
import { resolveCrmAssistantActionTarget } from "@/modules/ai/crmAssistant/actionTargets";
import { computeCrmAssistantConfidence, computeCrmAssistantMissingInformation } from "@/modules/ai/crmAssistant/confidence";

const RELEVANT_MEMORIES_LIMIT = 5;

function resolveActions(actions: CrmAssistantModelAction[]): CrmAssistantResolvedAction[] {
  return actions.map((action) => ({
    label: action.label,
    reason: action.reason,
    actionTarget: resolveCrmAssistantActionTarget(action.targetType, action.targetId),
  }));
}

/**
 * Combines the validated model output (narrative sections) with
 * deterministic context (everything else) into the final, UI-ready CRM
 * Assistant report. `confidence`/`missingInformation` are computed here,
 * entirely from `context.unavailableCategories` — never from the model's
 * own self-reported confidence, same principle as every other Bloom AI
 * Skill. `clientsAtRisk` merges the deterministic risk list with the
 * model's own per-client explanation (matched by `clientId`, `null` when
 * the model didn't provide one for that Client).
 */
export function assembleCrmAssistantBrief(modelOutput: CRMAssistantModelOutput, context: CrmAssistantContext): CrmAssistantBrief {
  const explanationByClientId = new Map(modelOutput.clientRiskExplanations.map((entry) => [entry.clientId, entry.explanation]));

  const clientsAtRisk: CrmAssistantResolvedClientRisk[] = context.clientsAtRisk.map((risk) => ({
    client: risk,
    explanation: explanationByClientId.get(risk.clientId) ?? null,
  }));

  return {
    executiveSummary: modelOutput.executiveSummary,
    relationshipHealth: {
      summary: modelOutput.relationshipHealthSummary,
      totalClients: context.totalClientCount,
      totalLeads: context.totalLeadCount,
      priorityClientCount: context.priorityClients.length,
      inactiveClientCount: context.inactiveClients.length,
      atRiskClientCount: context.clientsAtRisk.length,
    },
    priorityClients: context.priorityClients,
    inactiveClients: context.inactiveClients,
    clientsAtRisk,
    unsignedContracts: context.unsignedContracts,
    outstandingPayments: context.outstandingInvoices,
    outstandingBalanceMinor: context.outstandingBalanceMinor,
    outstandingCurrency: context.outstandingCurrency,
    upcomingOpportunities: resolveActions(modelOutput.upcomingOpportunities),
    suggestedFollowUps: resolveActions(modelOutput.suggestedFollowUps),
    recommendedActions: resolveActions(modelOutput.recommendedActions),
    confidence: computeCrmAssistantConfidence(context).score,
    missingInformation: computeCrmAssistantMissingInformation(context),
    relevantMemories: context.recentMemories.slice(0, RELEVANT_MEMORIES_LIMIT),
  };
}
