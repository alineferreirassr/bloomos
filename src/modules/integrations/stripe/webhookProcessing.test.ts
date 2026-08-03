import { afterEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { Payment } from "@/types/payment";
import type { Invoice } from "@/types/invoice";

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment_1",
    workspace_id: "ws_1",
    invoice_id: "inv_1",
    client_id: "client_1",
    event_id: "event_1",
    contract_id: null,
    payment_type: "deposit",
    status: "pending",
    amount_minor: 50000,
    currency: "usd",
    payment_method: "stripe",
    reference: "pi_123",
    transaction_date: "2026-01-01",
    received_at: null,
    failed_at: null,
    refunded_at: null,
    notes: null,
    document_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const { state } = vi.hoisted(() => ({
  state: { payments: [] as Payment[] },
}));

vi.mock("@/lib/data", () => ({
  createPayment: vi.fn(async (input: Record<string, unknown>) => {
    const payment = { id: `payment_${state.payments.length + 1}`, workspace_id: "ws_1", status: "pending", ...input } as Payment;
    state.payments.push(payment);
    return { success: true, data: payment };
  }),
  markPaymentSucceeded: vi.fn(async (id: string) => {
    const payment = state.payments.find((p) => p.id === id);
    if (!payment) return { success: false, error: "not found" };
    payment.status = "succeeded";
    return { success: true, data: payment };
  }),
  markPaymentFailed: vi.fn(async (id: string) => {
    const payment = state.payments.find((p) => p.id === id);
    if (!payment) return { success: false, error: "not found" };
    payment.status = "failed";
    return { success: true, data: payment };
  }),
  refundPayment: vi.fn(async (id: string, amountMinor: number) => {
    const payment = state.payments.find((p) => p.id === id);
    if (!payment) return { success: false, error: "not found" };
    payment.status = "refunded";
    return { success: true, data: { ...payment, amount_minor: amountMinor, payment_type: "refund" } };
  }),
  getPayments: vi.fn(async (filters: { clientId?: string } = {}) => state.payments.filter((p) => !filters.clientId || p.client_id === filters.clientId)),
  getInvoiceById: vi.fn(async (id: string): Promise<Invoice> => ({
    id,
    workspace_id: "ws_1",
    client_id: "client_1",
    event_id: "event_1",
    contract_id: null,
    invoice_number: "INV-1",
    title: "Invoice",
    description: null,
    status: "paid",
    issue_date: "2026-01-01",
    due_date: "2026-02-01",
    subtotal_minor: 50000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 50000,
    paid_minor: 50000,
    balance_minor: 0,
    currency: "usd",
    notes: null,
    sent_at: null,
    viewed_at: null,
    paid_at: "2026-01-02T00:00:00.000Z",
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  })),
}));

const dispatchAutomationTrigger = vi.fn().mockResolvedValue([]);
vi.mock("@/core/automation/resolver", () => ({
  dispatchAutomationTrigger: (...args: unknown[]) => dispatchAutomationTrigger(...args),
}));

const publishIntegrationEvent = vi.fn();
vi.mock("@/core/integrations/eventBus", () => ({
  publishIntegrationEvent: (...args: unknown[]) => publishIntegrationEvent(...args),
}));

const recordAuditEvent = vi.fn().mockResolvedValue({ id: "audit_1" });
vi.mock("@/core/audit", () => ({
  getCoreAuditLogService: () => ({ recordAuditEvent }),
}));

import { processStripeWebhookEvent } from "@/modules/integrations/stripe/webhookProcessing";
import { createPayment, markPaymentSucceeded } from "@/lib/data";

function stripeEvent(type: string, object: Record<string, unknown>): Stripe.Event {
  return { id: "evt_1", type, data: { object } } as unknown as Stripe.Event;
}

const BLOOM_META = { bloomos_workspace_id: "ws_1", bloomos_client_id: "client_1", bloomos_invoice_id: "inv_1", bloomos_event_id: "event_1", bloomos_payment_type: "deposit" };

afterEach(() => {
  vi.clearAllMocks();
  state.payments = [];
});

describe("checkout.session.completed", () => {
  it("creates a succeeded Payment from a real paid session, using the real amount_total", async () => {
    const event = stripeEvent("checkout.session.completed", { id: "cs_1", payment_status: "paid", payment_intent: "pi_real_1", amount_total: 50000, currency: "usd", metadata: BLOOM_META });
    const result = await processStripeWebhookEvent("ws_1", "conn_1", event);

    expect(result.handled).toBe(true);
    expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({ amount_minor: 50000, payment_method: "stripe", reference: "pi_real_1" }));
    expect(markPaymentSucceeded).toHaveBeenCalled();
    expect(publishIntegrationEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "payment.succeeded" }));
    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(expect.objectContaining({ type: "payment.received" }), expect.anything());
    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(expect.objectContaining({ type: "deposit.paid" }), expect.anything());
    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(expect.objectContaining({ type: "invoice.paid" }), expect.anything());
  });

  it("ignores a session with no BloomOS metadata", async () => {
    const event = stripeEvent("checkout.session.completed", { id: "cs_2", payment_status: "paid", payment_intent: "pi_2", amount_total: 1000, currency: "usd", metadata: {} });
    const result = await processStripeWebhookEvent("ws_1", "conn_1", event);
    expect(result.handled).toBe(false);
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("is idempotent when the same payment_intent arrives twice (dual checkout.session.completed + payment_intent.succeeded events)", async () => {
    const sessionEvent = stripeEvent("checkout.session.completed", { id: "cs_3", payment_status: "paid", payment_intent: "pi_dual", amount_total: 20000, currency: "usd", metadata: BLOOM_META });
    await processStripeWebhookEvent("ws_1", "conn_1", sessionEvent);
    expect(createPayment).toHaveBeenCalledTimes(1);

    const intentEvent = stripeEvent("payment_intent.succeeded", { id: "pi_dual", amount_received: 20000, currency: "usd", metadata: BLOOM_META });
    await processStripeWebhookEvent("ws_1", "conn_1", intentEvent);
    expect(createPayment).toHaveBeenCalledTimes(1); // still 1 — no duplicate Payment row
  });
});

describe("payment_intent.payment_failed", () => {
  it("creates a failed Payment and dispatches payment.failed", async () => {
    const event = stripeEvent("payment_intent.payment_failed", { id: "pi_fail_1", amount: 15000, currency: "usd", metadata: BLOOM_META });
    const result = await processStripeWebhookEvent("ws_1", "conn_1", event);
    expect(result.handled).toBe(true);
    expect(state.payments[0].status).toBe("failed");
    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(expect.objectContaining({ type: "payment.failed" }), expect.anything());
  });
});

describe("charge.refunded", () => {
  it("refunds the matching BloomOS payment via the existing Finance refundPayment path", async () => {
    state.payments.push(makePayment({ id: "payment_orig", reference: "pi_refund_target", status: "succeeded" }));
    const event = stripeEvent("charge.refunded", { id: "ch_1", payment_intent: "pi_refund_target", amount_refunded: 25000 });
    const result = await processStripeWebhookEvent("ws_1", "conn_1", event);
    expect(result.handled).toBe(true);
    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(expect.objectContaining({ type: "refund.issued" }), expect.anything());
  });

  it("is a no-op when the payment was already refunded (e.g. through our own Refund Center)", async () => {
    state.payments.push(makePayment({ id: "payment_orig", reference: "pi_already_refunded", status: "refunded" }));
    const event = stripeEvent("charge.refunded", { id: "ch_2", payment_intent: "pi_already_refunded", amount_refunded: 25000 });
    const result = await processStripeWebhookEvent("ws_1", "conn_1", event);
    expect(result.summary).toMatch(/already reconciled/);
  });
});

describe("customer.updated / customer.deleted", () => {
  it("only records an audit entry — never writes back into the BloomOS Client record", async () => {
    const event = stripeEvent("customer.updated", { id: "cus_1" });
    const result = await processStripeWebhookEvent("ws_1", "conn_1", event);
    expect(result.handled).toBe(true);
    expect(recordAuditEvent).toHaveBeenCalledWith("ws_1", expect.objectContaining({ action: "stripe.customer.updated" }));
  });
});

describe("unhandled event types", () => {
  it("returns handled:false for an event type this checkpoint doesn't process", async () => {
    const event = stripeEvent("account.updated", { id: "acct_1" });
    const result = await processStripeWebhookEvent("ws_1", "conn_1", event);
    expect(result.handled).toBe(false);
  });
});
