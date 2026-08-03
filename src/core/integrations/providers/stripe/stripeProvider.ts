import type Stripe from "stripe";
import type { PaymentProvider, WebhookProvider } from "@/core/integrations/sdk";
import type { ProviderCapability } from "@/core/integrations/types";
import { mapStripeEventToWebhookEvent } from "@/core/integrations/providers/stripe/stripeEventMapping";

/**
 * v2 Checkpoint 23 — BloomOS's first real Integration SDK implementation.
 * Implements the generic `PaymentProvider`/`WebhookProvider` contracts
 * `sdk.ts` (Checkpoint 22) declared and left unimplemented, using the
 * real `stripe` npm SDK underneath. Every method here makes a genuine
 * Stripe API call — nothing in this file is mocked or simulated. Tests
 * inject a mocked `Stripe` client via the constructor; production code
 * always passes a real one built by `stripeClient.ts` from a workspace's
 * own resolved credential.
 *
 * Beyond the two generic interfaces, this class exposes the richer,
 * genuinely Stripe-shaped operations the checkpoint's own spec needs
 * (Customers, Products, Prices, Checkout Sessions, Payment Links,
 * Invoices) — `sdk.ts`'s abstract interfaces are deliberately generic
 * (Step 3's own "no interface favors one real provider's API shape"), so
 * a concrete provider is expected to offer more than its abstract
 * contract, not less.
 */
export class StripeProvider implements PaymentProvider, WebhookProvider {
  readonly providerId = "stripe";
  readonly capabilities: ProviderCapability[] = ["payment", "webhook"];

  constructor(private readonly client: Stripe) {}

  async ping(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      await this.client.balance.retrieve();
      return { ok: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - startedAt, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /** Real account identity + capability check — the "Credential Validation"/"Test Connection" step (Step 2) calls this, never `ping()` alone, since a retrievable account also confirms the key isn't malformed or revoked. `null` is Stripe's own documented way to mean "the account this key belongs to." */
  async retrieveAccount(): Promise<Stripe.Account> {
    return this.client.accounts.retrieve(null);
  }

  // ---------------------------------------------------------------------
  // PaymentProvider (generic sdk.ts contract)
  // ---------------------------------------------------------------------

  async createCharge(params: { amountMinor: number; currency: string; description: string }): Promise<{ externalChargeId: string; status: string }> {
    const intent = await this.client.paymentIntents.create({ amount: params.amountMinor, currency: params.currency, description: params.description });
    return { externalChargeId: intent.id, status: intent.status };
  }

  async refundCharge(externalChargeId: string, amountMinor?: number): Promise<{ externalRefundId: string; status: string }> {
    const refund = await this.client.refunds.create({ payment_intent: externalChargeId, amount: amountMinor });
    return { externalRefundId: refund.id, status: refund.status ?? "unknown" };
  }

  async getChargeStatus(externalChargeId: string): Promise<{ status: string }> {
    const intent = await this.client.paymentIntents.retrieve(externalChargeId);
    return { status: intent.status };
  }

  // ---------------------------------------------------------------------
  // WebhookProvider (generic sdk.ts contract) — inbound, the mirror image
  // of lib/webhooks/signature.ts's own outbound signing.
  // ---------------------------------------------------------------------

  verifyInboundSignature(params: { rawBody: string; signatureHeader: string; secret: string }): boolean {
    try {
      this.client.webhooks.constructEvent(params.rawBody, params.signatureHeader, params.secret);
      return true;
    } catch {
      return false;
    }
  }

  mapInboundEvent(providerEventName: string): string | null {
    return mapStripeEventToWebhookEvent(providerEventName);
  }

  /** Parses and verifies a raw webhook body in one step — what the route handler actually calls, since `stripe.webhooks.constructEvent` both verifies and parses. Throws `Stripe.errors.StripeSignatureVerificationError` on a bad signature, never silently returns an unverified event. */
  constructVerifiedEvent(rawBody: string, signatureHeader: string, webhookSecret: string): Stripe.Event {
    return this.client.webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
  }

  // ---------------------------------------------------------------------
  // Customers (Step 3)
  // ---------------------------------------------------------------------

  async createCustomer(params: { email: string; name: string; phone?: string | null; address?: Stripe.AddressParam; metadata: Record<string, string> }): Promise<Stripe.Customer> {
    return this.client.customers.create({ email: params.email, name: params.name, phone: params.phone ?? undefined, address: params.address, metadata: params.metadata });
  }

  async updateCustomer(stripeCustomerId: string, params: { email?: string; name?: string; phone?: string | null; address?: Stripe.AddressParam; metadata?: Record<string, string> }): Promise<Stripe.Customer> {
    return this.client.customers.update(stripeCustomerId, { email: params.email, name: params.name, phone: params.phone ?? undefined, address: params.address, metadata: params.metadata });
  }

  async retrieveCustomer(stripeCustomerId: string): Promise<Stripe.Customer | Stripe.DeletedCustomer> {
    return this.client.customers.retrieve(stripeCustomerId);
  }

  // ---------------------------------------------------------------------
  // Products & Prices (Step 4)
  // ---------------------------------------------------------------------

  async createProduct(params: { name: string; description?: string; metadata: Record<string, string> }): Promise<Stripe.Product> {
    return this.client.products.create({ name: params.name, description: params.description, metadata: params.metadata });
  }

  async updateProduct(stripeProductId: string, params: { name?: string; description?: string; active?: boolean; metadata?: Record<string, string> }): Promise<Stripe.Product> {
    return this.client.products.update(stripeProductId, params);
  }

  async archiveProduct(stripeProductId: string): Promise<Stripe.Product> {
    return this.client.products.update(stripeProductId, { active: false });
  }

  async createPrice(params: { productId: string; unitAmountMinor: number; currency: string; metadata?: Record<string, string> }): Promise<Stripe.Price> {
    return this.client.prices.create({ product: params.productId, unit_amount: params.unitAmountMinor, currency: params.currency, metadata: params.metadata });
  }

  /** Stripe Prices are immutable — a "price update" is archiving the old one and creating a new one, never a mutation. */
  async archivePrice(stripePriceId: string): Promise<Stripe.Price> {
    return this.client.prices.update(stripePriceId, { active: false });
  }

  // ---------------------------------------------------------------------
  // Checkout Sessions (Step 5)
  // ---------------------------------------------------------------------

  async createCheckoutSession(params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Checkout.Session> {
    return this.client.checkout.sessions.create(params);
  }

  async retrieveCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.client.checkout.sessions.retrieve(sessionId);
  }

  // ---------------------------------------------------------------------
  // Payment Links (Step 6)
  // ---------------------------------------------------------------------

  async createPaymentLink(params: Stripe.PaymentLinkCreateParams): Promise<Stripe.PaymentLink> {
    return this.client.paymentLinks.create(params);
  }

  async deactivatePaymentLink(paymentLinkId: string): Promise<Stripe.PaymentLink> {
    return this.client.paymentLinks.update(paymentLinkId, { active: false });
  }

  // ---------------------------------------------------------------------
  // Invoices (Step 7) — real Stripe Invoices, distinct from BloomOS's own
  // `Invoice` domain type; see docs/stripe-provider.md for how the two
  // relate.
  // ---------------------------------------------------------------------

  async createStripeInvoiceItem(params: { customerId: string; amountMinor: number; currency: string; description: string; invoiceId?: string }): Promise<Stripe.InvoiceItem> {
    return this.client.invoiceItems.create({ customer: params.customerId, amount: params.amountMinor, currency: params.currency, description: params.description, invoice: params.invoiceId });
  }

  async createStripeInvoice(params: { customerId: string; autoAdvance: boolean; metadata?: Record<string, string> }): Promise<Stripe.Invoice> {
    return this.client.invoices.create({ customer: params.customerId, auto_advance: params.autoAdvance, metadata: params.metadata, collection_method: "send_invoice", days_until_due: 30 });
  }

  async finalizeStripeInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    return this.client.invoices.finalizeInvoice(stripeInvoiceId);
  }

  async sendStripeInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    return this.client.invoices.sendInvoice(stripeInvoiceId);
  }

  async voidStripeInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    return this.client.invoices.voidInvoice(stripeInvoiceId);
  }

  async markStripeInvoiceUncollectible(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    return this.client.invoices.markUncollectible(stripeInvoiceId);
  }

  async retrieveStripeInvoice(stripeInvoiceId: string): Promise<Stripe.Invoice> {
    return this.client.invoices.retrieve(stripeInvoiceId);
  }

  // ---------------------------------------------------------------------
  // Refunds (Step 9)
  // ---------------------------------------------------------------------

  async createRefund(params: { paymentIntentId: string; amountMinor?: number; reason?: Stripe.RefundCreateParams.Reason; metadata?: Record<string, string> }): Promise<Stripe.Refund> {
    return this.client.refunds.create({ payment_intent: params.paymentIntentId, amount: params.amountMinor, reason: params.reason, metadata: params.metadata });
  }
}
