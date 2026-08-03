import type { CreateProposalDraftInput, ProposalLineItem, ProposalPaymentScheduleLine } from "@/types/proposal";
import type { ProposalContext, ProposalContextLineItem, ProposalLineItemOutput, ProposalModelOutput } from "@/modules/ai/proposal/types";

function resolveLineItem(output: ProposalLineItemOutput, byId: Map<string, ProposalContextLineItem>, isOptionalAddOn: boolean): ProposalLineItem {
  const source = byId.get(output.eventServiceId);
  if (!source) {
    // Unreachable in practice — `validateProposalSemantics` already rejects
    // any reference not present in `byId` before this function is ever
    // called. Guarded anyway so this function can never silently invent a
    // price for an id it doesn't recognize.
    throw new Error(`assembleProposalDraft: unresolved eventServiceId "${output.eventServiceId}" — semantic validation should have rejected this.`);
  }
  return {
    event_service_id: source.eventServiceId,
    label: source.label,
    description: output.note,
    price_minor: source.priceMinor,
    currency: source.currency,
    is_optional_add_on: isOptionalAddOn,
  };
}

/**
 * Turns the model's validated output — which only ever *references* real
 * services by id and proposes narrative/schedule text — into the fully
 * resolved fields a `ProposalDraft` needs, by joining each reference back
 * against `ProposalContext.selectedServices` (the deterministic source of
 * truth for label/price/currency). The model is never trusted to restate a
 * price; it only says which service and what note to attach.
 */
export function assembleProposalDraftInput(
  output: ProposalModelOutput,
  context: ProposalContext,
  eventId: string,
  clientId: string,
  parentProposalId: string | null,
  metadata: { provider: string; model: string; promptVersion: string; mock: boolean; latencyMs: number; generatedAt: string },
): CreateProposalDraftInput {
  const byId = new Map(context.selectedServices.map((service) => [service.eventServiceId, service]));

  const servicesIncluded = output.servicesIncluded.map((item) => resolveLineItem(item, byId, false));
  const optionalAddOns = output.optionalAddOns.map((item) => resolveLineItem(item, byId, true));

  const paymentTerms: ProposalPaymentScheduleLine[] = output.paymentTerms.map((line) => ({
    label: line.label,
    amount_minor: line.amountMinor,
    due_date: line.dueDate,
    description: line.description,
  }));

  // Every field named in either the model's own `missingInformation` or the
  // deterministic context's — a use case should never let the model's
  // omission hide a gap the context already knew about, nor vice versa.
  const missingInformation = [...new Set([...context.missingInformation, ...output.missingInformation])];

  return {
    event_id: eventId,
    client_id: clientId,
    parent_proposal_id: parentProposalId,
    executive_summary: output.executiveSummary,
    event_overview: output.eventOverview,
    services_included: servicesIncluded,
    timeline_summary: output.timelineSummary,
    pricing_summary: { subtotal_minor: context.pricingSummary.subtotalMinor, currency: context.pricingSummary.currency },
    payment_terms: paymentTerms,
    recommendations: output.recommendations,
    optional_add_ons: optionalAddOns,
    questions_for_client: output.questionsForClient,
    ai_confidence: context.confidence.score,
    missing_information: missingInformation,
    provider: metadata.provider,
    model: metadata.model,
    prompt_version: metadata.promptVersion,
    mock: metadata.mock,
    generation_latency_ms: metadata.latencyMs,
    generated_at: metadata.generatedAt,
  };
}
