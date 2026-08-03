import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { CrmAssistantContext } from "@/modules/ai/crmAssistant/types";

const MOCK_MODEL_NAME = "bloomos-crm-mock-v1";

/**
 * Deterministic mock for the CRM Assistant — same rationale as
 * `modules/ai/dailyBrief/mockProvider.ts`: never registered into the
 * global registry, always reflects the supplied context's real data
 * rather than a fixed string.
 */
export function createCrmAssistantMockProvider(): AIProvider {
  return {
    name: "mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const context = request.conversation.context.facts.crmAssistantContext as CrmAssistantContext | undefined;

      if (!context) {
        return {
          content: JSON.stringify({
            executiveSummary: "No CRM context was supplied.",
            relationshipHealthSummary: "Unable to assess relationship health.",
            clientRiskExplanations: [],
            upcomingOpportunities: [],
            suggestedFollowUps: [],
            recommendedActions: [],
          }),
          requiresApproval: true,
          model: MOCK_MODEL_NAME,
          finishReason: "error",
        };
      }

      const executiveSummary = [
        `${context.totalClientCount} Client(s) and ${context.activeLeads.length} active Lead(s) tracked.`,
        `${context.clientsAtRisk.length} Client(s) currently at risk.`,
        `${context.unsignedContracts.length} unsigned contract(s) and ${context.outstandingInvoices.length} outstanding invoice(s).`,
      ].join(" ");

      const relationshipHealthSummary =
        context.clientsAtRisk.length === 0
          ? "Overall relationship health is strong — no Clients currently need urgent attention."
          : `${context.clientsAtRisk.length} Client relationship(s) need attention this week.`;

      const clientRiskExplanations = context.clientsAtRisk.slice(0, 10).map((risk) => ({
        clientId: risk.clientId,
        explanation: risk.reasons[0] ?? "Needs review.",
      }));

      const upcomingOpportunities = context.activeLeads.slice(0, 5).map((lead) => ({
        label: `Follow up with ${lead.name}`,
        reason: `Lead is in "${lead.status}" stage.`,
        targetType: "lead" as const,
        targetId: lead.leadId,
      }));

      const suggestedFollowUps = context.priorityClients.slice(0, 5).map((client) => ({
        label: `Check in with ${client.name}`,
        reason: client.isVip ? "VIP Client." : "Has an upcoming Event soon.",
        targetType: "client" as const,
        targetId: client.clientId,
      }));

      const recommendedActions = [
        ...context.unsignedContracts.slice(0, 3).map((contract) => ({
          label: `Chase signature on Contract ${contract.contractNumber}`,
          reason: "Still unsigned.",
          targetType: "contract" as const,
          targetId: contract.contractId,
        })),
        ...context.outstandingInvoices.slice(0, 3).map((invoice) => ({
          label: `Follow up on Invoice ${invoice.invoiceNumber}`,
          reason: `Outstanding balance on this Invoice.`,
          targetType: "invoice" as const,
          targetId: invoice.invoiceId,
        })),
      ];

      return {
        content: JSON.stringify({
          executiveSummary,
          relationshipHealthSummary,
          clientRiskExplanations,
          upcomingOpportunities,
          suggestedFollowUps,
          recommendedActions,
        }),
        requiresApproval: true,
        model: MOCK_MODEL_NAME,
        finishReason: "stop",
      };
    },
  };
}
