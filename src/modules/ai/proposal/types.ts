/**
 * Everything the Proposal Generator's prompt needs, already resolved to
 * display-safe values and stripped of anything the provider has no
 * business seeing — raw internal-only Client fields (allergies,
 * accessibility needs, dietary restrictions, do-not-call, emergency
 * contact, VIP flag; see `src/types/client.ts`'s own "never expose to a
 * future Client Portal" comment) are never included here either, since a
 * proposal draft is headed toward eventually being client-facing. Every
 * field here is deterministic — computed from real Event/Client/
 * EventService/Contract/Note records, never invented — so the model can
 * only narrate and recommend on top of facts BloomOS already stands
 * behind.
 */
export interface ProposalContext {
  workspace: { id: string; name: string | null };
  event: {
    id: string;
    title: string;
    eventType: string;
    eventDate: string | null;
    locationName: string | null;
    guestCount: number | null;
    budgetMin: number | null;
    budgetMax: number | null;
    theme: string | null;
    colorPalette: string | null;
    packageName: string | null;
  };
  venue: {
    locationName: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    backupLocation: string | null;
    weatherPlan: string | null;
  };
  client: {
    name: string;
    relationshipStatus: string | null;
    favoriteColors: string | null;
    favoriteFlowers: string | null;
    favoriteMusic: string | null;
    favoriteFood: string | null;
    favoriteDrinks: string | null;
    favoriteRestaurants: string | null;
    preferredStyle: string | null;
    importantDates: { label: string; date: string }[];
  };
  selectedServices: ProposalContextLineItem[];
  pricingSummary: { subtotalMinor: number; currency: string };
  /**
   * `null` when no Contract exists yet for this Event — the common case
   * for a proposal drafted before any contract. Deliberately NOT suffixed
   * `Minor` — unlike `EventService.price_minor`/Invoice/Payment, Contract's
   * own `deposit_amount`/`remaining_balance` are stored as plain major-unit
   * numbers in `src/types/contract.ts` (a pre-existing inconsistency in
   * that type, not introduced here) — carried through as-is rather than
   * silently reinterpreting its unit.
   */
  paymentTerms: { depositAmount: number | null; remainingBalance: number | null; currency: string } | null;
  timelineSummary: {
    totalScheduleItems: number;
    spanStart: string | null;
    spanEnd: string | null;
    firstItemTitle: string | null;
    lastItemTitle: string | null;
  };
  /** Content of the Event's own Notes (pinned first), capped for context size — the closest existing BloomOS concept to "Consultation Notes". */
  consultationNotes: string[];
  /** Safe, business-relevant constraints derived from the Event record itself (never from Client's internal-only fields) — e.g. surprise-event confidentiality, accessibility of the venue is NOT included here (that's Client-internal). */
  importantConstraints: string[];
  missingInformation: string[];
  confidence: { score: number; reason: string };
  generatedAt: string;
}

export interface ProposalContextLineItem {
  eventServiceId: string;
  label: string;
  priceMinor: number;
  currency: string;
  isOptionalAddOn: boolean;
}

/** One line of "Services Included"/"Optional Add-ons" as the model returns it — `eventServiceId` must match one of `ProposalContext.selectedServices`; anything else is rejected before ever reaching a `ProposalDraft`. */
export interface ProposalLineItemOutput {
  eventServiceId: string;
  note: string | null;
}

export interface ProposalPaymentScheduleLineOutput {
  label: string;
  amountMinor: number;
  dueDate: string | null;
  description: string | null;
}

/**
 * A suggestion for a reusable memory, surfaced by the model but never
 * persisted directly — the Server Action turns this into a
 * `proposeMemory()` call (`core/ai/memory`), which itself always creates a
 * `"proposed"`, never-auto-approved entry. `null` when the model has
 * nothing worth remembering for next time.
 */
export interface ProposalMemorySuggestionOutput {
  scope: "workspace" | "user";
  content: string;
}

/**
 * The only shape the model is trusted to fill in — narrative synthesis,
 * recommendations, and line-item selection layered on top of
 * `ProposalContext`, never the facts themselves. Validated against
 * `proposalModelOutputSchema` before ever reaching semantic validation
 * (`validateProposalSemantics`) or `assembleProposalDraft`.
 */
export interface ProposalModelOutput {
  executiveSummary: string;
  eventOverview: string;
  servicesIncluded: ProposalLineItemOutput[];
  timelineSummary: string;
  paymentTerms: ProposalPaymentScheduleLineOutput[];
  recommendations: string[];
  optionalAddOns: ProposalLineItemOutput[];
  questionsForClient: string[];
  missingInformation: string[];
  suggestedMemory: ProposalMemorySuggestionOutput | null;
}
