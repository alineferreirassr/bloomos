import { describe, expect, it } from "vitest";
import { assembleProposalDraftInput } from "@/modules/ai/proposal/assembleProposalDraft";
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
      relationshipStatus: null,
      favoriteColors: null,
      favoriteFlowers: null,
      favoriteMusic: null,
      favoriteFood: null,
      favoriteDrinks: null,
      favoriteRestaurants: null,
      preferredStyle: null,
      importantDates: [],
    },
    selectedServices: [
      { eventServiceId: "es_1", label: "Photography", priceMinor: 50000, currency: "USD", isOptionalAddOn: false },
      { eventServiceId: "es_2", label: "Florals", priceMinor: 20000, currency: "USD", isOptionalAddOn: false },
    ],
    pricingSummary: { subtotalMinor: 70000, currency: "USD" },
    paymentTerms: null,
    timelineSummary: { totalScheduleItems: 0, spanStart: null, spanEnd: null, firstItemTitle: null, lastItemTitle: null },
    consultationNotes: [],
    importantConstraints: [],
    missingInformation: ["Budget range"],
    confidence: { score: 70, reason: "Missing: no budget range." },
    generatedAt: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeOutput(overrides: Partial<ProposalModelOutput> = {}): ProposalModelOutput {
  return {
    executiveSummary: "A summary.",
    eventOverview: "An overview.",
    servicesIncluded: [{ eventServiceId: "es_1", note: "Golden hour session" }],
    timelineSummary: "No schedule yet.",
    paymentTerms: [],
    recommendations: [],
    optionalAddOns: [{ eventServiceId: "es_2", note: null }],
    questionsForClient: [],
    missingInformation: ["Guest count"],
    suggestedMemory: null,
    ...overrides,
  };
}

const metadata = { provider: "mock", model: "bloomos-mock-proposal-v1", promptVersion: "proposal-generator-v1", mock: true, latencyMs: 42, generatedAt: "2026-07-25T00:00:00.000Z" };

describe("assembleProposalDraftInput", () => {
  it("resolves a servicesIncluded reference to its real label/price/currency from context, never trusting the model's own restatement", () => {
    const input = assembleProposalDraftInput(makeOutput(), makeContext(), "event_1", "client_1", null, metadata);
    expect(input.services_included).toEqual([
      { event_service_id: "es_1", label: "Photography", description: "Golden hour session", price_minor: 50000, currency: "USD", is_optional_add_on: false },
    ]);
  });

  it("marks optionalAddOns line items as is_optional_add_on: true", () => {
    const input = assembleProposalDraftInput(makeOutput(), makeContext(), "event_1", "client_1", null, metadata);
    expect(input.optional_add_ons).toEqual([
      { event_service_id: "es_2", label: "Florals", description: null, price_minor: 20000, currency: "USD", is_optional_add_on: true },
    ]);
  });

  it("merges context and model missingInformation, de-duplicated", () => {
    const input = assembleProposalDraftInput(
      makeOutput({ missingInformation: ["Budget range", "Guest count"] }),
      makeContext({ missingInformation: ["Budget range"] }),
      "event_1",
      "client_1",
      null,
      metadata,
    );
    expect(input.missing_information.sort()).toEqual(["Budget range", "Guest count"].sort());
  });

  it("carries the context's deterministic confidence score, not any model-reported value", () => {
    const input = assembleProposalDraftInput(makeOutput(), makeContext({ confidence: { score: 55, reason: "x" } }), "event_1", "client_1", null, metadata);
    expect(input.ai_confidence).toBe(55);
  });

  it("carries the pricing summary through unchanged from context", () => {
    const input = assembleProposalDraftInput(makeOutput(), makeContext(), "event_1", "client_1", null, metadata);
    expect(input.pricing_summary).toEqual({ subtotal_minor: 70000, currency: "USD" });
  });

  it("carries generation metadata through (provider/model/promptVersion/mock/latency)", () => {
    const input = assembleProposalDraftInput(makeOutput(), makeContext(), "event_1", "client_1", null, metadata);
    expect(input.provider).toBe("mock");
    expect(input.model).toBe("bloomos-mock-proposal-v1");
    expect(input.prompt_version).toBe("proposal-generator-v1");
    expect(input.mock).toBe(true);
    expect(input.generation_latency_ms).toBe(42);
  });

  it("carries parent_proposal_id through for a regeneration", () => {
    const input = assembleProposalDraftInput(makeOutput(), makeContext(), "event_1", "client_1", "proposal_prev", metadata);
    expect(input.parent_proposal_id).toBe("proposal_prev");
  });

  it("throws if a service reference can't be resolved — unreachable once semantic validation runs first, guarded anyway", () => {
    expect(() =>
      assembleProposalDraftInput(makeOutput({ servicesIncluded: [{ eventServiceId: "nonexistent", note: null }] }), makeContext(), "event_1", "client_1", null, metadata),
    ).toThrow(/unresolved eventServiceId/);
  });
});
