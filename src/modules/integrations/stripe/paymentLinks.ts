import QRCode from "qrcode";
import { getStripeProviderForWorkspace } from "@/core/integrations/providers/stripe/stripeClient";
import { getExistingStripeProductMapping, syncServiceToStripeProduct } from "@/modules/integrations/stripe/productSync";
import {
  insertStripePaymentLink,
  listExpiredActiveStripePaymentLinks,
  listStripePaymentLinksForWorkspace,
  markStripePaymentLinkDeactivated,
  type StripePaymentLinkRecord,
} from "@/lib/data/core/integrations/stripePaymentLinkStore";
import { getLogger } from "@/core/observability/logger";

/**
 * Payment Links (v2 Checkpoint 23, Step 6) — reusable, shareable Stripe
 * checkout URLs, distinct from a one-time Checkout Session
 * (`checkoutSessions.ts`). "Copy Link"/"Email Client"/"Client Portal" are
 * all just the same real `url` surfaced in different UI contexts, never
 * three different links. "QR Code" is a real QR code encoding that exact
 * URL, generated locally (the `qrcode` package) — Stripe's own API never
 * returns one. "Expiration" is BloomOS-tracked, since a real Stripe
 * `PaymentLink` has no native time-based expiry — see
 * `stripePaymentLinkStore.ts`'s own doc comment.
 */

export interface CreatePaymentLinkParams {
  workspaceId: string;
  createdBy: string;
  serviceId?: string;
  amountMinor?: number;
  currency?: string;
  description?: string;
  /** ISO timestamp — null (the default) means no expiration. */
  expiresAt?: string | null;
}

export interface CreatePaymentLinkResult {
  record: StripePaymentLinkRecord;
  /** A real `data:image/png;base64,...` URI — safe to drop straight into an `<img src>`. */
  qrCodeDataUri: string;
}

export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<CreatePaymentLinkResult> {
  const provider = await getStripeProviderForWorkspace(params.workspaceId);

  let priceId: string;
  let amountMinor = params.amountMinor ?? 0;
  const currency = params.currency ?? "usd";
  const description = params.description ?? "Payment";

  if (params.serviceId) {
    let mapping = getExistingStripeProductMapping(params.serviceId);
    if (!mapping?.stripe_price_id) {
      const synced = await syncServiceToStripeProduct(params.workspaceId, params.serviceId);
      mapping = synced.mapping;
    }
    if (!mapping.stripe_price_id) throw new Error(`Service "${params.serviceId}" has no active price — publish a Service Version first.`);
    priceId = mapping.stripe_price_id;
  } else if (params.amountMinor && params.amountMinor > 0) {
    const price = await provider.createPrice({ productId: (await provider.createProduct({ name: description, metadata: { bloomos_workspace_id: params.workspaceId } })).id, unitAmountMinor: params.amountMinor, currency });
    priceId = price.id;
    amountMinor = params.amountMinor;
  } else {
    throw new Error("A Payment Link needs either a serviceId or a positive amountMinor.");
  }

  const paymentLink = await provider.createPaymentLink({
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { bloomos_workspace_id: params.workspaceId, bloomos_service_id: params.serviceId ?? "" },
  });

  const record = insertStripePaymentLink({
    workspaceId: params.workspaceId,
    stripePaymentLinkId: paymentLink.id,
    url: paymentLink.url,
    serviceId: params.serviceId ?? null,
    description,
    amountMinor,
    currency,
    expiresAt: params.expiresAt ?? null,
    createdBy: params.createdBy,
  });

  const qrCodeDataUri = await QRCode.toDataURL(paymentLink.url, { margin: 1, width: 240 });
  getLogger().info("Stripe payment link created", { workspaceId: params.workspaceId, serviceId: params.serviceId, paymentLinkId: paymentLink.id });

  return { record, qrCodeDataUri };
}

export function listPaymentLinks(workspaceId: string): StripePaymentLinkRecord[] {
  return listStripePaymentLinksForWorkspace(workspaceId);
}

/** A `mailto:` URL pre-filling the client's own email client — never a real SMTP send, since no real email provider is connected anywhere in this codebase (see docs/integrations.md). */
export function buildPaymentLinkMailto(email: string, description: string, url: string): string {
  const subject = encodeURIComponent(`Payment link — ${description}`);
  const body = encodeURIComponent(`Hi,\n\nHere's your secure payment link: ${url}\n\nThank you!`);
  return `mailto:${email}?subject=${subject}&body=${body}`;
}

/** Deactivates every real Payment Link past its own tracked `expires_at` — called on demand (a Diagnostics/Dashboard load), never a background timer (Non-Goal: real background workers, same as every other Checkpoint 22/23 engine). */
export async function deactivateExpiredStripePaymentLinks(workspaceId: string): Promise<number> {
  const expired = listExpiredActiveStripePaymentLinks(workspaceId);
  if (expired.length === 0) return 0;
  const provider = await getStripeProviderForWorkspace(workspaceId);
  for (const record of expired) {
    await provider.deactivatePaymentLink(record.stripe_payment_link_id);
    markStripePaymentLinkDeactivated(record.id);
  }
  getLogger().info("Expired Stripe payment links deactivated", { workspaceId, count: expired.length });
  return expired.length;
}
