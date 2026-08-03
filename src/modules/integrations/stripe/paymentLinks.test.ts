import { afterEach, describe, expect, it, vi } from "vitest";

const { fakeProvider } = vi.hoisted(() => ({
  fakeProvider: {
    createPaymentLink: vi.fn().mockResolvedValue({ id: "plink_1", url: "https://buy.stripe.com/plink_1" }),
    createProduct: vi.fn().mockResolvedValue({ id: "prod_adhoc" }),
    createPrice: vi.fn().mockResolvedValue({ id: "price_adhoc" }),
    deactivatePaymentLink: vi.fn().mockResolvedValue({ id: "plink_1", active: false }),
  },
}));

vi.mock("@/core/integrations/providers/stripe/stripeClient", () => ({
  getStripeProviderForWorkspace: vi.fn().mockResolvedValue(fakeProvider),
}));

vi.mock("@/modules/integrations/stripe/productSync", () => ({
  getExistingStripeProductMapping: vi.fn().mockReturnValue({ stripe_price_id: "price_1" }),
  syncServiceToStripeProduct: vi.fn().mockResolvedValue({ mapping: { stripe_price_id: "price_synced" } }),
}));

import { createPaymentLink, deactivateExpiredStripePaymentLinks, listPaymentLinks, buildPaymentLinkMailto } from "@/modules/integrations/stripe/paymentLinks";
import { getExistingStripeProductMapping } from "@/modules/integrations/stripe/productSync";
import { resetStripePaymentLinkStore } from "@/lib/data/core/integrations/stripePaymentLinkStore";

afterEach(() => {
  vi.clearAllMocks();
  resetStripePaymentLinkStore();
  vi.mocked(getExistingStripeProductMapping).mockReturnValue({ stripe_price_id: "price_1" } as never);
});

describe("createPaymentLink", () => {
  it("creates a real Payment Link from an already-synced Service Price and a real QR code", async () => {
    const result = await createPaymentLink({ workspaceId: "ws_1", createdBy: "user_1", serviceId: "svc_1", description: "Luxury Picnic" });
    expect(fakeProvider.createPaymentLink).toHaveBeenCalledWith(expect.objectContaining({ line_items: [{ price: "price_1", quantity: 1 }] }));
    expect(result.record.url).toBe("https://buy.stripe.com/plink_1");
    expect(result.qrCodeDataUri.startsWith("data:image/png;base64,")).toBe(true);
    expect(listPaymentLinks("ws_1")).toHaveLength(1);
  });

  it("creates an ad-hoc Product+Price for a custom amount, with no serviceId", async () => {
    const result = await createPaymentLink({ workspaceId: "ws_1", createdBy: "user_1", amountMinor: 15000, currency: "usd", description: "Custom deposit" });
    expect(fakeProvider.createProduct).toHaveBeenCalled();
    expect(fakeProvider.createPrice).toHaveBeenCalledWith(expect.objectContaining({ unitAmountMinor: 15000, currency: "usd" }));
    expect(result.record.amount_minor).toBe(15000);
  });

  it("throws when neither serviceId nor amountMinor is given", async () => {
    await expect(createPaymentLink({ workspaceId: "ws_1", createdBy: "user_1" })).rejects.toThrow(/needs either a serviceId/);
  });
});

describe("buildPaymentLinkMailto", () => {
  it("builds a real mailto: URL — never a fabricated 'sent' claim", () => {
    const mailto = buildPaymentLinkMailto("client@example.test", "Deposit", "https://buy.stripe.com/plink_1");
    expect(mailto.startsWith("mailto:client@example.test?subject=")).toBe(true);
    expect(decodeURIComponent(mailto)).toContain("https://buy.stripe.com/plink_1");
  });
});

describe("deactivateExpiredStripePaymentLinks", () => {
  it("deactivates only links whose tracked expiration has passed", async () => {
    await createPaymentLink({ workspaceId: "ws_1", createdBy: "user_1", serviceId: "svc_1", expiresAt: new Date(Date.now() - 1000).toISOString() });
    await createPaymentLink({ workspaceId: "ws_1", createdBy: "user_1", serviceId: "svc_1", expiresAt: new Date(Date.now() + 100_000).toISOString() });

    const count = await deactivateExpiredStripePaymentLinks("ws_1");
    expect(count).toBe(1);
    expect(fakeProvider.deactivatePaymentLink).toHaveBeenCalledTimes(1);
  });
});
