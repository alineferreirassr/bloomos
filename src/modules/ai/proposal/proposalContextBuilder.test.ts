import { describe, expect, it } from "vitest";
import { composeProposalContext } from "@/modules/ai/proposal/proposalContextBuilder";
import type { ClientContextData } from "@/modules/ai/contextBuilders/clientContextBuilder";
import type { EventServiceAssignmentContextItem } from "@/modules/ai/contextBuilders/eventServiceAssignmentContextBuilder";
import type { ProposalDetailsContextData } from "@/modules/ai/contextBuilders/proposalDetailsContextBuilder";

const client: ClientContextData = {
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
};

const details: ProposalDetailsContextData = {
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
  timelineSummary: { totalScheduleItems: 0, spanStart: null, spanEnd: null, firstItemTitle: null, lastItemTitle: null },
  consultationNotes: [],
  importantConstraints: [],
  contractPaymentTerms: null,
  eventMissingInformation: ["Budget range"],
};

describe("composeProposalContext", () => {
  it("computes pricingSummary.subtotalMinor as the sum of selected services", () => {
    const services: EventServiceAssignmentContextItem[] = [
      { eventServiceId: "es_1", label: "Photography", priceMinor: 50000, currency: "USD" },
      { eventServiceId: "es_2", label: "Florals", priceMinor: 20000, currency: "USD" },
    ];
    const context = composeProposalContext({ id: "ws_1", name: "Amoré Bloom" }, client, services, details);
    expect(context.pricingSummary).toEqual({ subtotalMinor: 70000, currency: "USD" });
  });

  it("falls back to the Contract's currency when no services are selected", () => {
    const context = composeProposalContext(
      { id: "ws_1", name: "Amoré Bloom" },
      client,
      [],
      { ...details, contractPaymentTerms: { depositAmount: 100, remainingBalance: 200, currency: "EUR" } },
    );
    expect(context.pricingSummary.currency).toBe("EUR");
  });

  it("adds 'Selected services' to missingInformation when no services are assigned", () => {
    const context = composeProposalContext({ id: "ws_1", name: "Amoré Bloom" }, client, [], details);
    expect(context.missingInformation).toContain("Selected services");
  });

  it("does not flag missing services when at least one is assigned", () => {
    const services: EventServiceAssignmentContextItem[] = [{ eventServiceId: "es_1", label: "Photography", priceMinor: 50000, currency: "USD" }];
    const context = composeProposalContext({ id: "ws_1", name: "Amoré Bloom" }, client, services, details);
    expect(context.missingInformation).not.toContain("Selected services");
  });

  it("carries the event-level missing information through unchanged", () => {
    const context = composeProposalContext({ id: "ws_1", name: "Amoré Bloom" }, client, [], details);
    expect(context.missingInformation).toContain("Budget range");
  });

  it("computes a lower confidence score when key inputs are missing", () => {
    const withServices = composeProposalContext(
      { id: "ws_1", name: "Amoré Bloom" },
      client,
      [{ eventServiceId: "es_1", label: "Photography", priceMinor: 50000, currency: "USD" }],
      { ...details, consultationNotes: ["A note."], eventMissingInformation: [] },
    );
    const withoutServices = composeProposalContext({ id: "ws_1", name: "Amoré Bloom" }, client, [], details);
    expect(withoutServices.confidence.score).toBeLessThan(withServices.confidence.score);
  });

  it("never invents a service — selectedServices always exactly mirrors the eventServiceAssignment section", () => {
    const services: EventServiceAssignmentContextItem[] = [{ eventServiceId: "es_1", label: "Photography", priceMinor: 50000, currency: "USD" }];
    const context = composeProposalContext({ id: "ws_1", name: "Amoré Bloom" }, client, services, details);
    expect(context.selectedServices).toEqual([{ eventServiceId: "es_1", label: "Photography", priceMinor: 50000, currency: "USD", isOptionalAddOn: false }]);
  });
});
