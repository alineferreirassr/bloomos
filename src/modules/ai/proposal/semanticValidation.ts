import type { ProposalContext, ProposalModelOutput } from "@/modules/ai/proposal/types";

type ValidationResult = { success: true; value: ProposalModelOutput } | { success: false; error: string };

/**
 * The semantic cross-checks a Zod shape alone can't express — passed to
 * `applySemanticValidation` (`core/ai/structuredOutput.ts`) as this use
 * case's own `semanticValidate`. Every check here rejects the draft
 * outright rather than silently dropping the offending part, since a
 * hallucinated service, price, or schedule in a client-facing proposal is
 * a business risk `parseStructuredOutput`'s schema stage alone can't catch.
 */
export function validateProposalSemantics(output: ProposalModelOutput, context: ProposalContext): ValidationResult {
  const knownServiceIds = new Set(context.selectedServices.map((service) => service.eventServiceId));

  for (const item of [...output.servicesIncluded, ...output.optionalAddOns]) {
    if (!knownServiceIds.has(item.eventServiceId)) {
      return { success: false, error: "The proposal referenced a service that isn't actually assigned to this Event." };
    }
  }

  if (output.paymentTerms.length > 0) {
    const scheduledTotal = output.paymentTerms.reduce((sum, line) => sum + line.amountMinor, 0);
    if (scheduledTotal !== context.pricingSummary.subtotalMinor) {
      return { success: false, error: "The proposed payment schedule doesn't add up to the actual pricing total." };
    }
  }

  return { success: true, value: output };
}
