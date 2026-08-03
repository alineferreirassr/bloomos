import { afterEach, describe, expect, it, vi } from "vitest";
import type { Invoice } from "@/types/invoice";
import type { ClientAccountContext } from "@/types/clientAccount";

const { fakeInvoice, fakeContext } = vi.hoisted(() => {
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
  const fakeContext = {
    account: {
      id: "account_1",
      workspace_id: "ws_1",
      client_id: "client_1",
      auth_user_id: "auth_1",
      email: "client@example.com",
      status: "active",
      invited_by: "member_1",
      accepted_at: "2026-01-01T00:00:00.000Z",
      suspended_at: null,
      revoked_at: null,
      last_access_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    clientName: "Jane Doe",
    workspaceName: "Amoré Bloom",
  };
  return { fakeInvoice, fakeContext };
});

const getCurrentClientAccountContext = vi.fn<() => Promise<ClientAccountContext | null>>().mockResolvedValue(fakeContext as ClientAccountContext);
vi.mock("@/lib/data", () => ({
  getInvoiceById: vi.fn().mockResolvedValue(fakeInvoice),
  getCurrentClientAccountContext: (...args: unknown[]) => getCurrentClientAccountContext(...(args as [])),
}));

const createDepositCheckoutSession = vi.fn().mockResolvedValue({ sessionId: "cs_1", url: "https://checkout.stripe.com/cs_1" });
const createRemainingBalanceCheckoutSession = vi.fn().mockResolvedValue({ sessionId: "cs_2", url: "https://checkout.stripe.com/cs_2" });
vi.mock("@/modules/integrations/stripe/checkoutSessions", () => ({
  createDepositCheckoutSession: (...args: unknown[]) => createDepositCheckoutSession(...args),
  createRemainingBalanceCheckoutSession: (...args: unknown[]) => createRemainingBalanceCheckoutSession(...args),
}));

vi.mock("@/modules/integrations/stripe/stripeInvoices", () => ({
  getExistingStripeInvoiceMapping: vi.fn().mockReturnValue({ invoice_pdf_url: "https://stripe.com/invoice.pdf" }),
}));

import { createClientPortalBalanceCheckoutAction, createClientPortalDepositCheckoutAction, getClientPortalInvoicePdfAction } from "@/modules/integrations/stripe/clientPortalPaymentActions";

afterEach(() => {
  vi.clearAllMocks();
  getCurrentClientAccountContext.mockResolvedValue(fakeContext as ClientAccountContext);
});

describe("createClientPortalDepositCheckoutAction", () => {
  it("rejects when the resolved session belongs to a different client than the invoice (never trusts a caller-supplied id)", async () => {
    getCurrentClientAccountContext.mockResolvedValueOnce({ ...fakeContext, account: { ...fakeContext.account, client_id: "someone_else" } } as ClientAccountContext);
    const result = await createClientPortalDepositCheckoutAction("inv_1", 10000, "https://a", "https://b");
    expect(result.success).toBe(false);
  });

  it("rejects with no resolvable client session", async () => {
    getCurrentClientAccountContext.mockResolvedValueOnce(null);
    const result = await createClientPortalDepositCheckoutAction("inv_1", 10000, "https://a", "https://b");
    expect(result.success).toBe(false);
  });

  it("rejects a deposit larger than the remaining balance", async () => {
    const result = await createClientPortalDepositCheckoutAction("inv_1", 999999, "https://a", "https://b");
    expect(result.success).toBe(false);
  });

  it("creates a real checkout session for a valid deposit", async () => {
    const result = await createClientPortalDepositCheckoutAction("inv_1", 20000, "https://a", "https://b");
    expect(result.success).toBe(true);
    if (result.success) expect(result.url).toBe("https://checkout.stripe.com/cs_1");
    expect(createDepositCheckoutSession).toHaveBeenCalledWith("ws_1", "inv_1", 20000, "https://a", "https://b");
  });
});

describe("createClientPortalBalanceCheckoutAction", () => {
  it("creates a real checkout session for the invoice's own real balance", async () => {
    const result = await createClientPortalBalanceCheckoutAction("inv_1", "https://a", "https://b");
    expect(result.success).toBe(true);
    expect(createRemainingBalanceCheckoutSession).toHaveBeenCalledWith("ws_1", "inv_1", "https://a", "https://b");
  });
});

describe("getClientPortalInvoicePdfAction", () => {
  it("returns the real Stripe-hosted PDF url when one exists", async () => {
    const result = await getClientPortalInvoicePdfAction("inv_1");
    expect(result).toEqual({ success: true, url: "https://stripe.com/invoice.pdf" });
  });

  it("rejects when the resolved session's client doesn't own the invoice", async () => {
    getCurrentClientAccountContext.mockResolvedValueOnce({ ...fakeContext, account: { ...fakeContext.account, client_id: "someone_else" } } as ClientAccountContext);
    const result = await getClientPortalInvoicePdfAction("inv_1");
    expect(result.success).toBe(false);
  });
});
