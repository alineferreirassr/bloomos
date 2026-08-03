import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { Payment } from "@/types/payment";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

const { fakePayment, fakeProvider, fakeConnection } = vi.hoisted(() => {
  const fakePayment: Payment = {
    id: "payment_1",
    workspace_id: "ws_1",
    invoice_id: "inv_1",
    client_id: "client_1",
    event_id: "event_1",
    contract_id: null,
    payment_type: "full_payment",
    status: "succeeded",
    amount_minor: 50000,
    currency: "usd",
    payment_method: "stripe",
    reference: "pi_real_123",
    transaction_date: "2026-01-01",
    received_at: "2026-01-01T00:00:00.000Z",
    failed_at: null,
    refunded_at: null,
    notes: null,
    document_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
  const fakeProvider = { createRefund: vi.fn().mockResolvedValue({ id: "re_real_1", status: "succeeded" }) };
  const fakeConnection = { id: "conn_stripe_1" };
  return { fakePayment, fakeProvider, fakeConnection };
});

vi.mock("@/lib/data", () => ({
  getPaymentById: vi.fn().mockResolvedValue(fakePayment),
  refundPayment: vi.fn().mockResolvedValue({ success: true, data: { id: "payment_refund_1" } }),
}));

vi.mock("@/core/integrations/providers/stripe/stripeClient", () => ({
  getStripeProviderForWorkspace: vi.fn().mockResolvedValue(fakeProvider),
  getStripeConnectionForWorkspace: vi.fn().mockReturnValue(fakeConnection),
}));

vi.mock("@/core/audit", () => ({
  getCoreAuditLogService: vi.fn().mockReturnValue({ recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit_1" }) }),
}));

import { refundStripePaymentAction } from "@/modules/integrations/stripe/refundActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPaymentById, refundPayment } from "@/lib/data";
import { getCoreAuditLogService } from "@/core/audit";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["finance.refund"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("refundStripePaymentAction", () => {
  it("requires finance.refund", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await refundStripePaymentAction("payment_1", 10000);
    expect(result.success).toBe(false);
  });

  it("rejects a payment that wasn't made through Stripe", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(getPaymentById).mockResolvedValueOnce({ ...fakePayment, payment_method: "cash" });
    const result = await refundStripePaymentAction("payment_1", 10000);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/wasn't made through Stripe/);
  });

  it("calls the real Stripe refund API, then the existing Finance refundPayment path, and records a real audit entry", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await refundStripePaymentAction("payment_1", 25000, "requested_by_customer", "Client changed their mind");

    expect(fakeProvider.createRefund).toHaveBeenCalledWith(expect.objectContaining({ paymentIntentId: "pi_real_123", amountMinor: 25000, reason: "requested_by_customer" }));
    expect(refundPayment).toHaveBeenCalledWith("payment_1", 25000);
    expect(vi.mocked(getCoreAuditLogService)().recordAuditEvent).toHaveBeenCalledWith("ws_1", expect.objectContaining({ action: "payment.refunded", ownerType: "payment", ownerId: "payment_1" }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stripeRefundId).toBe("re_real_1");
      expect(result.data.bloomosRefundPaymentId).toBe("payment_refund_1");
    }
  });

  it("never touches the Finance ledger when the real Stripe refund call fails", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    fakeProvider.createRefund.mockRejectedValueOnce(new Error("Charge already refunded"));

    const result = await refundStripePaymentAction("payment_1", 25000);
    expect(result.success).toBe(false);
    expect(refundPayment).not.toHaveBeenCalled();
  });
});
