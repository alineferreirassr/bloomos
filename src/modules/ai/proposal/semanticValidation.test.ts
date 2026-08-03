import { describe, expect, it } from "vitest";
import { validateProposalSemantics } from "@/modules/ai/proposal/semanticValidation";
import type { ProposalContext, ProposalModelOutput } from "@/modules/ai/proposal/types";

function makeContext(overrides: Partial<ProposalContext> = {}): ProposalContext {
  return {
    workspace: { id: "ws_1", name: "Amoré Bloom" },
    event: {
      id: "event_1",
      title: "Beachfront Proposal",
      eventType: "Proposal",
      eventDate: "2026-09-01",
      locationName: "El Matador State Beach",
      guestCount: 2,
      budgetMin: null,
      budgetMax: null,
      theme: null,
      colorPalette: null,
      packageName: null,
    },
    venue: { locationName: "El Matador State Beach", address: null, city: null, state: null, backupLocation: null, weatherPlan: null },
    client: {
      name: "Jamie Rivera",
      relationshipStatus: "Dating",
      favoriteColors: null,
      favoriteFlowers: null,
      favoriteMusic: null,
      favoriteFood: null,
      favoriteDrinks: null,
      favoriteRestaurants: null,
      preferredStyle: null,
      importantDates: [],
    },
    selectedServices: [{ eventServiceId: "es_1", label: "Photography", priceMinor: 50000, currency: "USD", isOptionalAddOn: false }],
    pricingSummary: { subtotalMinor: 50000, currency: "USD" },
    paymentTerms: null,
    timelineSummary: { totalScheduleItems: 0, spanStart: null, spanEnd: null, firstItemTitle: null, lastItemTitle: null },
    consultationNotes: [],
    importantConstraints: [],
    missingInformation: [],
    confidence: { score: 80, reason: "All key inputs are present." },
    generatedAt: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeOutput(overrides: Partial<ProposalModelOutput> = {}): ProposalModelOutput {
  return {
    executiveSummary: "A summary.",
    eventOverview: "An overview.",
    servicesIncluded: [{ eventServiceId: "es_1", note: null }],
    timelineSummary: "No schedule yet.",
    paymentTerms: [],
    recommendations: [],
    optionalAddOns: [],
    questionsForClient: [],
    missingInformation: [],
    suggestedMemory: null,
    ...overrides,
  };
}

describe("validateProposalSemantics", () => {
  it("passes a valid output referencing only real assigned services", () => {
    const result = validateProposalSemantics(makeOutput(), makeContext());
    expect(result.success).toBe(true);
  });

  it("rejects a servicesIncluded reference to a service not assigned to this Event", () => {
    const result = validateProposalSemantics(makeOutput({ servicesIncluded: [{ eventServiceId: "invented_service", note: null }] }), makeContext());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/isn't actually assigned/i);
  });

  it("rejects an optionalAddOns reference to a service not assigned to this Event", () => {
    const result = validateProposalSemantics(
      makeOutput({ servicesIncluded: [], optionalAddOns: [{ eventServiceId: "invented_addon", note: null }] }),
      makeContext(),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a payment schedule that doesn't sum to the actual pricing total", () => {
    const result = validateProposalSemantics(
      makeOutput({ paymentTerms: [{ label: "Full balance", amountMinor: 99999, dueDate: null, description: null }] }),
      makeContext(),
    );
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/doesn't add up/i);
  });

  it("accepts a payment schedule that sums exactly to the pricing total, split across lines", () => {
    const result = validateProposalSemantics(
      makeOutput({
        paymentTerms: [
          { label: "Deposit", amountMinor: 20000, dueDate: null, description: null },
          { label: "Balance", amountMinor: 30000, dueDate: null, description: null },
        ],
      }),
      makeContext(),
    );
    expect(result.success).toBe(true);
  });

  it("accepts an empty payment schedule without checking a sum", () => {
    const result = validateProposalSemantics(makeOutput({ paymentTerms: [] }), makeContext());
    expect(result.success).toBe(true);
  });
});
