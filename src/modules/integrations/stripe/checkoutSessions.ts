import type Stripe from "stripe";
import { getInvoiceById } from "@/lib/data";
import { getStripeProviderForWorkspace } from "@/core/integrations/providers/stripe/stripeClient";
import { syncClientToStripeCustomer } from "@/modules/integrations/stripe/customerSync";
import { getExistingStripeProductMapping, syncServiceToStripeProduct } from "@/modules/integrations/stripe/productSync";
import type { PaymentType } from "@/core/enums/paymentType";

/**
 * Checkout Sessions (v2 Checkpoint 23, Step 5). Deliberately never
 * pre-computes or persists a BloomOS `Payment` at session-creation time —
 * Stripe's own coupon/discount/tax math can change the real amount
 * charged, so the single source of truth for "how much was actually
 * paid" is the real `amount_total` Stripe reports back on
 * `checkout.session.completed` (Step 8/10/11 creates the `Payment` row
 * then, from that real webhook payload). This function's only job is to
 * build a real, correctly-priced Stripe Checkout Session and hand back
 * its real hosted URL.
 */

export interface CheckoutLineItemInput {
  /** Uses the Service's own synced Stripe Price — auto-syncs it first if it isn't yet, or is stale. */
  serviceId?: string;
  /** An ad-hoc amount (Deposit / Remaining Balance / Custom Amount) — never a pre-created Price. */
  amountMinor?: number;
  description?: string;
  quantity?: number;
}

export interface CreateCheckoutSessionParams {
  workspaceId: string;
  clientId: string;
  invoiceId?: string | null;
  eventId?: string | null;
  paymentType: PaymentType;
  currency: string;
  lineItems: CheckoutLineItemInput[];
  /** A real Stripe Coupon id (`coupon_...`) — never validated or fabricated here, Stripe itself rejects an invalid one. */
  couponId?: string;
  /** Off by default — no real tax registration exists this checkpoint; the parameter exists so a future checkpoint can turn it on with zero code changes here (the spec's own "Taxes (future-ready)"). */
  enableAutomaticTax?: boolean;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResult {
  sessionId: string;
  url: string;
}

async function resolveLineItem(workspaceId: string, input: CheckoutLineItemInput, currency: string): Promise<Stripe.Checkout.SessionCreateParams.LineItem> {
  if (input.serviceId) {
    let mapping = getExistingStripeProductMapping(input.serviceId);
    if (!mapping?.stripe_price_id) {
      const synced = await syncServiceToStripeProduct(workspaceId, input.serviceId);
      mapping = synced.mapping;
    }
    if (!mapping.stripe_price_id) throw new Error(`Service "${input.serviceId}" has no active price — publish a Service Version first.`);
    return { price: mapping.stripe_price_id, quantity: input.quantity ?? 1 };
  }
  if (input.amountMinor && input.amountMinor > 0) {
    return {
      price_data: { currency, unit_amount: input.amountMinor, product_data: { name: input.description ?? "Payment" } },
      quantity: input.quantity ?? 1,
    };
  }
  throw new Error("Each Checkout line item needs either a serviceId or a positive amountMinor.");
}

export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<CreateCheckoutSessionResult> {
  if (params.lineItems.length === 0) throw new Error("At least one line item is required to create a Checkout Session.");

  const provider = await getStripeProviderForWorkspace(params.workspaceId);
  const { mapping: customerMapping } = await syncClientToStripeCustomer(params.workspaceId, params.clientId);
  const lineItems = await Promise.all(params.lineItems.map((item) => resolveLineItem(params.workspaceId, item, params.currency)));

  const session = await provider.createCheckoutSession({
    mode: "payment",
    customer: customerMapping.stripe_customer_id,
    line_items: lineItems,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    discounts: params.couponId ? [{ coupon: params.couponId }] : undefined,
    automatic_tax: params.enableAutomaticTax ? { enabled: true } : undefined,
    metadata: {
      bloomos_workspace_id: params.workspaceId,
      bloomos_client_id: params.clientId,
      bloomos_invoice_id: params.invoiceId ?? "",
      bloomos_event_id: params.eventId ?? "",
      bloomos_payment_type: params.paymentType,
    },
    // Also copies this metadata onto the resulting real PaymentIntent —
    // Stripe never does this automatically. Without it, a
    // `payment_intent.succeeded`/`payment_intent.payment_failed` webhook
    // (which always also fires alongside `checkout.session.completed`
    // for a Checkout payment) would carry no BloomOS-side identifiers at
    // all, making the webhook handler's own idempotent dual-event
    // handling impossible.
    payment_intent_data: {
      metadata: {
        bloomos_workspace_id: params.workspaceId,
        bloomos_client_id: params.clientId,
        bloomos_invoice_id: params.invoiceId ?? "",
        bloomos_event_id: params.eventId ?? "",
        bloomos_payment_type: params.paymentType,
      },
    },
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL for this session.");
  return { sessionId: session.id, url: session.url };
}

/** Deposit — a fixed, staff- or client-entered amount against an existing Invoice. */
export async function createDepositCheckoutSession(workspaceId: string, invoiceId: string, depositAmountMinor: number, successUrl: string, cancelUrl: string): Promise<CreateCheckoutSessionResult> {
  const invoice = await getInvoiceById(invoiceId);
  return createCheckoutSession({
    workspaceId,
    clientId: invoice.client_id,
    invoiceId,
    eventId: invoice.event_id,
    paymentType: "deposit",
    currency: invoice.currency,
    lineItems: [{ amountMinor: depositAmountMinor, description: `Deposit — ${invoice.title}` }],
    successUrl,
    cancelUrl,
  });
}

/** Remaining Balance — always the Invoice's own real `balance_minor`, never a client-entered figure. */
export async function createRemainingBalanceCheckoutSession(workspaceId: string, invoiceId: string, successUrl: string, cancelUrl: string): Promise<CreateCheckoutSessionResult> {
  const invoice = await getInvoiceById(invoiceId);
  if (invoice.balance_minor <= 0) throw new Error("This Invoice has no remaining balance.");
  return createCheckoutSession({
    workspaceId,
    clientId: invoice.client_id,
    invoiceId,
    eventId: invoice.event_id,
    paymentType: "final_payment",
    currency: invoice.currency,
    lineItems: [{ amountMinor: invoice.balance_minor, description: `Remaining balance — ${invoice.title}` }],
    successUrl,
    cancelUrl,
  });
}
