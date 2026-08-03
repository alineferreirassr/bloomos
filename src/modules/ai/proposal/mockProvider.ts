import type { AICompletion, AICompletionRequest, AIProvider } from "@/core/ai/types";
import type { ProposalContext } from "@/modules/ai/proposal/types";

const MOCK_MODEL_NAME = "bloomos-mock-proposal-v1";

/**
 * Deterministic, provider-agnostic stand-in used whenever `isAIConfigured()`
 * is false — same rationale and precedent as `modules/ai/mockProvider.ts`'s
 * Event Operations Brief mock. Every sentence is built from the supplied
 * `ProposalContext`'s own fields, never a fixed string — it never invents a
 * service, price, or payment term of its own, only narrates what's already
 * in context.
 */
export function createProposalMockAIProvider(): AIProvider {
  return {
    name: "mock",
    async complete(request: AICompletionRequest): Promise<AICompletion> {
      const context = request.conversation.context.facts.proposalContext as ProposalContext | undefined;

      if (!context) {
        return {
          content: JSON.stringify({
            executiveSummary: "No proposal context was supplied.",
            eventOverview: "No event context was supplied.",
            servicesIncluded: [],
            timelineSummary: "No schedule context was supplied.",
            paymentTerms: [],
            recommendations: ["Regenerate this proposal — no context was supplied."],
            optionalAddOns: [],
            questionsForClient: [],
            missingInformation: [],
            suggestedMemory: null,
          }),
          requiresApproval: true,
          model: MOCK_MODEL_NAME,
          finishReason: "error",
        };
      }

      const budgetPart =
        context.event.budgetMin !== null || context.event.budgetMax !== null
          ? ` within a budget of ${context.event.budgetMin ?? "?"}–${context.event.budgetMax ?? "?"}`
          : "";
      const executiveSummary = `A proposal for ${context.client.name}'s ${context.event.eventType.toLowerCase()}${
        context.event.eventDate ? ` on ${context.event.eventDate}` : ""
      }${context.event.locationName ? ` at ${context.event.locationName}` : ""}, covering ${context.selectedServices.length} selected service(s)${budgetPart}.`;

      const eventOverview = `${context.event.eventType} for ${context.client.name}${
        context.event.eventDate ? `, scheduled for ${context.event.eventDate}` : ", date not yet set"
      }${context.event.locationName ? ` at ${context.event.locationName}` : ""}${
        context.event.guestCount !== null ? ` for ${context.event.guestCount} guests` : ""
      }.`;

      const timelineSummary =
        context.timelineSummary.totalScheduleItems === 0
          ? "No schedule items exist for this Event yet."
          : `${context.timelineSummary.totalScheduleItems} schedule item(s), from "${context.timelineSummary.firstItemTitle}" to "${context.timelineSummary.lastItemTitle}".`;

      const servicesIncluded = context.selectedServices.map((service) => ({ eventServiceId: service.eventServiceId, note: null }));

      const paymentTerms =
        context.pricingSummary.subtotalMinor > 0
          ? [
              {
                label: "Full balance",
                amountMinor: context.pricingSummary.subtotalMinor,
                dueDate: null,
                description: "A single payment covering all selected services.",
              },
            ]
          : [];

      const recommendations: string[] = [];
      if (context.selectedServices.length === 0) {
        recommendations.push("No services are selected yet — assign services to this Event before sending a proposal.");
      }
      if (context.missingInformation.length > 0) {
        recommendations.push(`Resolve missing information before sending: ${context.missingInformation.join(", ")}.`);
      }

      const questionsForClient: string[] = [];
      if (context.event.budgetMin === null && context.event.budgetMax === null) {
        questionsForClient.push("What is your target budget range for this event?");
      }
      if (context.event.guestCount === null) {
        questionsForClient.push("How many guests are you expecting?");
      }

      const output = {
        executiveSummary,
        eventOverview,
        servicesIncluded,
        timelineSummary,
        paymentTerms,
        recommendations,
        optionalAddOns: [],
        questionsForClient,
        missingInformation: context.missingInformation,
        suggestedMemory: null,
      };

      return {
        content: JSON.stringify(output),
        requiresApproval: true,
        model: MOCK_MODEL_NAME,
        finishReason: "stop",
      };
    },
  };
}
