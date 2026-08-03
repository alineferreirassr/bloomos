import type { ClientContextData } from "@/modules/ai/contextBuilders/clientContextBuilder";
import type { EventServiceAssignmentContextItem } from "@/modules/ai/contextBuilders/eventServiceAssignmentContextBuilder";
import type { ProposalDetailsContextData } from "@/modules/ai/contextBuilders/proposalDetailsContextBuilder";
import type { ProposalContext } from "@/modules/ai/proposal/types";

/** Bumped whenever `ProposalContext`'s shape changes — carried through onto `ProposalDraft.prompt_version` alongside the prompt version so a stored draft can always be traced to the exact context shape that produced it. */
export const PROPOSAL_CONTEXT_VERSION = "proposal-generator-context-v1";

function computeConfidence(params: {
  hasEventDate: boolean;
  hasLocation: boolean;
  hasBudget: boolean;
  hasSelectedServices: boolean;
  hasNotes: boolean;
}): { score: number; reason: string } {
  const missing: string[] = [];
  let score = 100;
  if (!params.hasEventDate) {
    score -= 20;
    missing.push("no event date");
  }
  if (!params.hasLocation) {
    score -= 15;
    missing.push("no location");
  }
  if (!params.hasBudget) {
    score -= 15;
    missing.push("no budget range");
  }
  if (!params.hasSelectedServices) {
    score -= 30;
    missing.push("no services selected");
  }
  if (!params.hasNotes) {
    score -= 10;
    missing.push("no consultation notes");
  }
  const reason = missing.length === 0 ? "All key inputs are present." : `Missing: ${missing.join(", ")}.`;
  return { score: Math.max(score, 0), reason };
}

/**
 * Pure and deterministic — combines what the Context Orchestrator already
 * assembled in parallel (`workspace`, `client`, `eventServiceAssignment`,
 * `proposalContext` sections) into the single shape the Proposal
 * Generator's prompt needs. Never fetches anything itself — every raw read
 * already happened inside each section's own `AIContextBuilder`; this is
 * only the final join, the same role `buildEventOperationsBriefContext`
 * plays for its own feature, just composing pre-fetched sections instead
 * of raw entities directly.
 */
export function composeProposalContext(
  workspace: { id: string; name: string | null },
  client: ClientContextData,
  eventServices: EventServiceAssignmentContextItem[],
  details: ProposalDetailsContextData,
  now: Date = new Date(),
): ProposalContext {
  const selectedServices = eventServices.map((service) => ({
    eventServiceId: service.eventServiceId,
    label: service.label,
    priceMinor: service.priceMinor,
    currency: service.currency,
    isOptionalAddOn: false,
  }));
  const subtotalMinor = selectedServices.reduce((sum, item) => sum + item.priceMinor, 0);
  const currency = eventServices[0]?.currency ?? details.contractPaymentTerms?.currency ?? "USD";

  const missingInformation = [...new Set([...details.eventMissingInformation, ...(eventServices.length === 0 ? ["Selected services"] : [])])];

  const confidence = computeConfidence({
    hasEventDate: details.event.eventDate !== null,
    hasLocation: details.event.locationName !== null,
    hasBudget: details.event.budgetMin !== null || details.event.budgetMax !== null,
    hasSelectedServices: eventServices.length > 0,
    hasNotes: details.consultationNotes.length > 0,
  });

  return {
    workspace,
    event: details.event,
    venue: details.venue,
    client,
    selectedServices,
    pricingSummary: { subtotalMinor, currency },
    paymentTerms: details.contractPaymentTerms,
    timelineSummary: details.timelineSummary,
    consultationNotes: details.consultationNotes,
    importantConstraints: details.importantConstraints,
    missingInformation,
    confidence,
    generatedAt: now.toISOString(),
  };
}
