import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types/invoice";

const { fakeInvoice, fakeProvider } = vi.hoisted(() => {
  const fakeInvoice: Invoice = {
    id: "inv_1",
    workspace_id: "ws_1",
    client_id: "client_1",
    event_id: "event_1",
    contract_id: null,
    invoice_number: "INV-0001",
    title: "Wedding Photography",
    description: null,
    status: "sent",
    issue_date: "2026-01-01",
    due_date: "2026-02-01",
    subtotal_minor: 100000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 100000,
    paid_minor: 40000,
    balance_minor: 60000,
    currency: "usd",
    notes: null,
    sent_at: "2026-01-01T00:00:00.000Z",
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const fakeProvider = {
    createStripeInvoice: vi.fn().mockResolvedValue({ id: "in_1", status: "draft" }),
    createStripeInvoiceItem: vi.fn().mockResolvedValue({ id: "ii_1" }),
    finalizeStripeInvoice: vi.fn().mockResolvedValue({ id: "in_1", status: "open" }),
    sendStripeInvoice: vi.fn().mockResolvedValue({ id: "in_1", status: "open" }),
    voidStripeInvoice: vi.fn().mockResolvedValue({ id: "in_1", status: "void" }),
    markStripeInvoiceUncollectible: vi.fn().mockResolvedValue({ id: "in_1", status: "uncollectible" }),
  };
  return { fakeInvoice, fakeProvider };
});

vi.mock("@/lib/data", () => ({
  getInvoiceById: vi.fn().mockResolvedValue(fakeInvoice),
}));

vi.mock("@/core/integrations/providers/stripe/stripeClient", () => ({
  getStripeProviderForWorkspace: vi.fn().mockResolvedValue(fakeProvider),
}));

vi.mock("@/modules/integrations/stripe/customerSync", () => ({
  syncClientToStripeCustomer: vi.fn().mockResolvedValue({ mapping: { stripe_customer_id: "cus_1" } }),
}));

import { createStripeInvoiceFromBloomInvoice, markStripeInvoiceUncollectible, voidStripeInvoice } from "@/modules/integrations/stripe/stripeInvoices";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createStripeInvoiceFromBloomInvoice", () => {
  it("creates a draft invoice, adds one item for the real remaining balance, and finalizes it (open) when sendEmail isn't requested", async () => {
    const result = await createStripeInvoiceFromBloomInvoice({ workspaceId: "ws_1", invoiceId: "inv_1" });
    expect(fakeProvider.createStripeInvoice).toHaveBeenCalledWith(expect.objectContaining({ customerId: "cus_1", autoAdvance: false }));
    expect(fakeProvider.createStripeInvoiceItem).toHaveBeenCalledWith(expect.objectContaining({ amountMinor: 60000, currency: "usd", invoiceId: "in_1" }));
    expect(fakeProvider.finalizeStripeInvoice).toHaveBeenCalledWith("in_1");
    expect(fakeProvider.sendStripeInvoice).not.toHaveBeenCalled();
    expect(result.status).toBe("open");
  });

  it("sends the invoice via Stripe's own real automatic email when sendEmail is true", async () => {
    await createStripeInvoiceFromBloomInvoice({ workspaceId: "ws_1", invoiceId: "inv_1", sendEmail: true });
    expect(fakeProvider.sendStripeInvoice).toHaveBeenCalledWith("in_1");
  });
});

describe("voidStripeInvoice / markStripeInvoiceUncollectible", () => {
  it("voids a real Stripe invoice", async () => {
    const result = await voidStripeInvoice("ws_1", "in_1");
    expect(fakeProvider.voidStripeInvoice).toHaveBeenCalledWith("in_1");
    expect(result.status).toBe("void");
  });

  it("marks a real Stripe invoice uncollectible", async () => {
    const result = await markStripeInvoiceUncollectible("ws_1", "in_1");
    expect(fakeProvider.markStripeInvoiceUncollectible).toHaveBeenCalledWith("in_1");
    expect(result.status).toBe("uncollectible");
  });
});
