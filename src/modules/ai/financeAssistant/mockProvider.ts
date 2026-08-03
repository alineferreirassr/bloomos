import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import { formatMoney } from "@/lib/money";
import type { FinanceAssistantContext } from "@/modules/ai/financeAssistant/types";

const MOCK_MODEL_NAME = "bloomos-finance-mock-v1";

/**
 * Deterministic mock for the Finance Assistant — same rationale as
 * `modules/ai/crmAssistant/mockProvider.ts`: never registered into the
 * global registry, always reflects the supplied context's real data
 * rather than a fixed string.
 */
export function createFinanceAssistantMockProvider(): AIProvider {
  return {
    name: "mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const context = request.conversation.context.facts.financeAssistantContext as FinanceAssistantContext | undefined;

      if (!context) {
        return {
          content: JSON.stringify({
            executiveSummary: "No Finance context was supplied.",
            revenueOverviewSummary: "Unable to assess revenue.",
            cashFlowSummary: "Unable to assess cash flow.",
            financialRiskExplanations: [],
            revenueOpportunities: [],
            recommendations: [],
          }),
          requiresApproval: true,
          model: MOCK_MODEL_NAME,
          finishReason: "error",
        };
      }

      const executiveSummary = [
        `${formatMoney(context.collectedThisMonthMinor, context.currency)} collected and ${formatMoney(context.outstandingReceivablesMinor, context.currency)} outstanding.`,
        `${context.paymentDelays.length} payment(s) overdue and ${context.financialRisks.length} financial risk(s) identified.`,
        `${formatMoney(context.contractValueUnsignedMinor, context.currency)} in unsigned Contract value.`,
      ].join(" ");

      const revenueOverviewSummary = `Revenue this month is ${formatMoney(context.revenueThisMonthMinor, context.currency)}, with ${formatMoney(context.collectedThisMonthMinor, context.currency)} collected so far.`;

      const cashFlowSummary =
        context.upcomingRevenue.length === 0
          ? `${formatMoney(context.outstandingReceivablesMinor, context.currency)} outstanding, no revenue expected in the next 30 days.`
          : `${formatMoney(context.outstandingReceivablesMinor, context.currency)} outstanding, with ${formatMoney(sumUpcoming(context), context.currency)} expected soon.`;

      const financialRiskExplanations = context.financialRisks.slice(0, 10).map((risk) => ({
        riskId: risk.riskId,
        explanation: risk.reasons[0] ?? "Needs review.",
      }));

      const revenueOpportunities = context.unsignedContracts.slice(0, 5).map((contract) => ({
        label: `Finalize Contract ${contract.contractNumber}`,
        reason: `${formatMoney(contract.totalValueMinor, contract.currency)} in unsigned Contract value.`,
        targetType: "contract" as const,
        targetId: contract.contractId,
      }));

      const recommendations = context.paymentDelays.slice(0, 5).map((invoice) => ({
        label: `Follow up on Invoice ${invoice.invoiceNumber}`,
        reason: `${formatMoney(invoice.balanceMinor, invoice.currency)} overdue.`,
        targetType: "invoice" as const,
        targetId: invoice.invoiceId,
      }));

      return {
        content: JSON.stringify({
          executiveSummary,
          revenueOverviewSummary,
          cashFlowSummary,
          financialRiskExplanations,
          revenueOpportunities,
          recommendations,
        }),
        requiresApproval: true,
        model: MOCK_MODEL_NAME,
        finishReason: "stop",
      };
    },
  };
}

function sumUpcoming(context: FinanceAssistantContext): number {
  return context.upcomingRevenue.reduce((sum, invoice) => sum + invoice.balanceMinor, 0);
}
