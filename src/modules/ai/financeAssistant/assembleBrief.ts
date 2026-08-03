import type {
  FinanceAssistantContext,
  FinanceAssistantModelOutput,
  FinanceAssistantBrief,
  FinanceAssistantResolvedAction,
  FinanceAssistantResolvedRisk,
  FinanceAssistantModelAction,
} from "@/modules/ai/financeAssistant/types";
import { resolveFinanceAssistantActionTarget } from "@/modules/ai/financeAssistant/actionTargets";
import { computeFinanceAssistantConfidence, computeFinanceAssistantMissingInformation } from "@/modules/ai/financeAssistant/confidence";

const RELEVANT_MEMORIES_LIMIT = 5;

function resolveActions(actions: FinanceAssistantModelAction[]): FinanceAssistantResolvedAction[] {
  return actions.map((action) => ({
    label: action.label,
    reason: action.reason,
    actionTarget: resolveFinanceAssistantActionTarget(action.targetType, action.targetId),
  }));
}

/**
 * Combines the validated model output (narrative sections) with
 * deterministic context (everything else) into the final, UI-ready Finance
 * Assistant report. `confidence`/`missingInformation` are computed here,
 * entirely from `context.unavailableCategories` — never from the model's
 * own self-reported confidence, same principle as every other Bloom AI
 * Skill. `financialRisks` merges the deterministic risk list with the
 * model's own per-risk explanation (matched by `riskId`, `null` when the
 * model didn't provide one for that risk).
 */
export function assembleFinanceAssistantBrief(modelOutput: FinanceAssistantModelOutput, context: FinanceAssistantContext): FinanceAssistantBrief {
  const explanationByRiskId = new Map(modelOutput.financialRiskExplanations.map((entry) => [entry.riskId, entry.explanation]));

  const financialRisks: FinanceAssistantResolvedRisk[] = context.financialRisks.map((risk) => ({
    risk,
    explanation: explanationByRiskId.get(risk.riskId) ?? null,
  }));

  const upcomingMinor = context.upcomingRevenue.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);

  return {
    executiveSummary: modelOutput.executiveSummary,
    revenueOverview: {
      summary: modelOutput.revenueOverviewSummary,
      revenueThisMonthMinor: context.revenueThisMonthMinor,
      collectedThisMonthMinor: context.collectedThisMonthMinor,
      totalInvoicedAllTimeMinor: context.totalInvoicedAllTimeMinor,
      totalCollectedAllTimeMinor: context.totalCollectedAllTimeMinor,
      currency: context.currency,
    },
    outstandingPayments: context.outstandingInvoices,
    upcomingRevenue: context.upcomingRevenue,
    cashFlowSnapshot: {
      summary: modelOutput.cashFlowSummary,
      collectedMinor: context.collectedThisMonthMinor,
      outstandingMinor: context.outstandingReceivablesMinor,
      upcomingMinor,
      refundedMinor: context.refundsThisMonthMinor,
      expensesMinor: context.expensesThisMonthMinor,
      netCashPositionMinor: context.netCashPositionMinor,
      currency: context.currency,
    },
    financialRisks,
    paymentDelays: context.paymentDelays,
    contractValue: {
      totalMinor: context.contractValueTotalMinor,
      signedMinor: context.contractValueSignedMinor,
      unsignedMinor: context.contractValueUnsignedMinor,
      currency: context.currency,
    },
    revenueOpportunities: resolveActions(modelOutput.revenueOpportunities),
    recommendations: resolveActions(modelOutput.recommendations),
    confidence: computeFinanceAssistantConfidence(context).score,
    missingInformation: computeFinanceAssistantMissingInformation(context),
    relevantMemories: context.recentMemories.slice(0, RELEVANT_MEMORIES_LIMIT),
    crmRecommendations: context.crmRecommendations,
  };
}
