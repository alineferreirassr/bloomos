import type Stripe from "stripe";

/**
 * v2 Checkpoint 23, Step 19 — Testing infrastructure. Reusable,
 * deterministic Stripe fixtures every test file in this checkpoint uses
 * (directly or as the pattern it follows), so a future checkpoint
 * extending Stripe never has to re-invent "how do I fake a Checkout
 * Session completing" from scratch. Every builder returns realistic,
 * internally-consistent shapes — never a bare `{}` a real handler
 * wouldn't actually receive.
 *
 * "Stripe Test Mode" itself needs no fixture: it's just a real
 * `sk_test_...`/`whsec_...` key pair, which the real `StripeProvider`
 * already handles identically to a live key — see `docs/stripe-provider.md`.
 */

export interface FakeStripeClientOverrides {
  [namespace: string]: Record<string, unknown>;
}

/** A minimal fake matching only the Stripe SDK surface `StripeProvider` actually calls — no real network call, ever. Merge in `overrides` to customize specific methods per test. */
export function createFakeStripeClient(overrides: FakeStripeClientOverrides = {}): Stripe {
  const base: FakeStripeClientOverrides = {
    balance: { retrieve: async () => ({ available: [] }) },
    accounts: { retrieve: async () => ({ id: "acct_fake", email: "owner@example.test" }) },
    paymentIntents: { create: async () => ({ id: "pi_fake", status: "requires_payment_method" }), retrieve: async () => ({ id: "pi_fake", status: "succeeded" }) },
    refunds: { create: async () => ({ id: "re_fake", status: "succeeded" }) },
    webhooks: { constructEvent: () => ({ id: "evt_fake", type: "checkout.session.completed", data: { object: {} } }) },
    customers: { create: async () => ({ id: "cus_fake" }), update: async () => ({ id: "cus_fake" }), retrieve: async () => ({ id: "cus_fake" }) },
    products: { create: async () => ({ id: "prod_fake" }), update: async () => ({ id: "prod_fake" }) },
    prices: { create: async () => ({ id: "price_fake" }), update: async () => ({ id: "price_fake" }) },
    checkout: { sessions: { create: async () => ({ id: "cs_fake", url: "https://checkout.stripe.com/cs_fake" }), retrieve: async () => ({ id: "cs_fake" }) } },
    paymentLinks: { create: async () => ({ id: "plink_fake", url: "https://buy.stripe.com/plink_fake" }), update: async () => ({ id: "plink_fake" }) },
    invoiceItems: { create: async () => ({ id: "ii_fake" }) },
    invoices: {
      create: async () => ({ id: "in_fake", status: "draft" }),
      finalizeInvoice: async () => ({ id: "in_fake", status: "open" }),
      sendInvoice: async () => ({ id: "in_fake", status: "open" }),
      voidInvoice: async () => ({ id: "in_fake", status: "void" }),
      markUncollectible: async () => ({ id: "in_fake", status: "uncollectible" }),
      retrieve: async () => ({ id: "in_fake", status: "paid" }),
    },
  };

  const merged: FakeStripeClientOverrides = { ...base };
  for (const [namespace, methods] of Object.entries(overrides)) {
    merged[namespace] = { ...(base[namespace] ?? {}), ...methods };
  }
  return merged as unknown as Stripe;
}

export interface BloomMetadataFixture {
  bloomos_workspace_id: string;
  bloomos_client_id: string;
  bloomos_invoice_id: string;
  bloomos_event_id: string;
  bloomos_payment_type: string;
}

export function buildBloomMetadataFixture(overrides: Partial<BloomMetadataFixture> = {}): BloomMetadataFixture {
  return { bloomos_workspace_id: "ws_1", bloomos_client_id: "client_1", bloomos_invoice_id: "inv_1", bloomos_event_id: "event_1", bloomos_payment_type: "deposit", ...overrides };
}

/** A real, internally-consistent `checkout.session.completed` event shape — the primary "money received" event this checkpoint's webhook handler processes. */
export function buildCheckoutSessionCompletedEvent(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Event {
  const session = { id: "cs_fake", payment_status: "paid", payment_intent: "pi_fake", amount_total: 50000, currency: "usd", metadata: buildBloomMetadataFixture(), ...overrides };
  return { id: "evt_fake", type: "checkout.session.completed", data: { object: session } } as unknown as Stripe.Event;
}

/** A real `payment_intent.payment_failed` event shape. */
export function buildPaymentIntentFailedEvent(overrides: Partial<Stripe.PaymentIntent> = {}): Stripe.Event {
  const intent = { id: "pi_fake", amount: 50000, currency: "usd", metadata: buildBloomMetadataFixture(), ...overrides };
  return { id: "evt_fake", type: "payment_intent.payment_failed", data: { object: intent } } as unknown as Stripe.Event;
}

/** A real `charge.refunded` event shape. */
export function buildChargeRefundedEvent(overrides: Partial<Stripe.Charge> = {}): Stripe.Event {
  const charge = { id: "ch_fake", payment_intent: "pi_fake", amount_refunded: 25000, ...overrides };
  return { id: "evt_fake", type: "charge.refunded", data: { object: charge } } as unknown as Stripe.Event;
}
