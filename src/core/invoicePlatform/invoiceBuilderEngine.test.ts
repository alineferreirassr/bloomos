import { describe, it, expect } from "vitest";
import { assembleSnapshot, nextVersionNumber, buildInvoiceVersion, nextStatusAfterVersion, currentVersionOf } from "@/core/invoicePlatform/invoiceBuilderEngine";
import { makeHeader, makeFooter, makeSection, makeLineItem, makeBuilderState, makeVersion } from "@/core/invoicePlatform/testFixtures";
import type { CreateInvoiceVersionInput } from "@/types/invoicePlatform";

function createInput(overrides: Partial<CreateInvoiceVersionInput> = {}): CreateInvoiceVersionInput {
  return {
    templateId: "template_1",
    templateKey: "luxury_event",
    header: makeHeader(),
    sections: [makeSection()],
    lineItems: [makeLineItem({ amount_minor: 10000 })],
    adjustments: [],
    paymentSchedule: [],
    terms: "Standard terms.",
    policies: "Standard policy.",
    notes: "",
    footer: makeFooter(),
    reason: null,
    ...overrides,
  };
}

describe("assembleSnapshot", () => {
  it("computes pricing from the line items and reuses the real paid_minor", () => {
    const snapshot = assembleSnapshot({ createInput: createInput(), currency: "USD", paidToDate_minor: 2000 });
    expect(snapshot.pricing.grandTotal_minor).toBe(10000);
    expect(snapshot.pricing.paidToDate_minor).toBe(2000);
    expect(snapshot.pricing.outstandingBalance_minor).toBe(8000);
  });

  it("freezes the input by value into the snapshot", () => {
    const input = createInput({ terms: "Custom terms." });
    const snapshot = assembleSnapshot({ createInput: input, currency: "USD", paidToDate_minor: 0 });
    expect(snapshot.terms).toBe("Custom terms.");
    expect(snapshot.templateKey).toBe("luxury_event");
  });
});

describe("nextVersionNumber", () => {
  it("returns 1 for an empty version list", () => {
    expect(nextVersionNumber([])).toBe(1);
  });

  it("returns one more than the highest existing version number", () => {
    const versions = [makeVersion({ version_number: 1 }), makeVersion({ version_number: 2 })];
    expect(nextVersionNumber(versions)).toBe(3);
  });
});

describe("buildInvoiceVersion", () => {
  it("assigns the next sequential version number", () => {
    const version = buildInvoiceVersion("invoice_1", "ws_test", [], { createInput: createInput(), currency: "USD", paidToDate_minor: 0 }, "member_1");
    expect(version.version_number).toBe(1);
    expect(version.invoice_id).toBe("invoice_1");
  });
});

describe("nextStatusAfterVersion", () => {
  it("always leaves the first version in draft", () => {
    expect(nextStatusAfterVersion("draft", true)).toBe("draft");
    expect(nextStatusAfterVersion("published", true)).toBe("draft");
  });

  it("moves a published document to review on a later version", () => {
    expect(nextStatusAfterVersion("published", false)).toBe("review");
  });

  it("leaves a draft or review document's status unchanged on a later version", () => {
    expect(nextStatusAfterVersion("draft", false)).toBe("draft");
    expect(nextStatusAfterVersion("review", false)).toBe("review");
  });
});

describe("currentVersionOf", () => {
  it("resolves the version matching current_version_id", () => {
    const state = makeBuilderState();
    const version = currentVersionOf(state);
    expect(version?.id).toBe(state.current_version_id);
  });

  it("returns null when current_version_id is null", () => {
    const state = makeBuilderState({ current_version_id: null });
    expect(currentVersionOf(state)).toBeNull();
  });
});
