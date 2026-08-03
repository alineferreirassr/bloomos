import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2 Checkpoint 23, Step 6 — Payment Link bookkeeping. Real Stripe
 * `PaymentLink` objects have no native time-based expiration field (only
 * a Checkout *Session* does) — Stripe's own API only supports
 * deactivating a link outright (`active: false`) or capping it to N
 * completed sessions. "Expiration" here is therefore BloomOS's own
 * tracked `expires_at`, enforced by `deactivateExpiredStripePaymentLinks`
 * calling the real `deactivatePaymentLink` once that time passes — never
 * a fabricated Stripe capability.
 */
export interface StripePaymentLinkRecord {
  id: string;
  workspace_id: string;
  stripe_payment_link_id: string;
  url: string;
  service_id: string | null;
  description: string;
  amount_minor: number;
  currency: string;
  expires_at: string | null;
  deactivated_at: string | null;
  created_by: string;
  created_at: string;
}

let records: StripePaymentLinkRecord[] = [];

export function resetStripePaymentLinkStore(): void {
  records = [];
}

export interface InsertStripePaymentLinkInput {
  workspaceId: string;
  stripePaymentLinkId: string;
  url: string;
  serviceId: string | null;
  description: string;
  amountMinor: number;
  currency: string;
  expiresAt: string | null;
  createdBy: string;
}

export function insertStripePaymentLink(input: InsertStripePaymentLinkInput): StripePaymentLinkRecord {
  const record: StripePaymentLinkRecord = {
    id: generateId("stripe-payment-link"),
    workspace_id: input.workspaceId,
    stripe_payment_link_id: input.stripePaymentLinkId,
    url: input.url,
    service_id: input.serviceId,
    description: input.description,
    amount_minor: input.amountMinor,
    currency: input.currency,
    expires_at: input.expiresAt,
    deactivated_at: null,
    created_by: input.createdBy,
    created_at: nowIso(),
  };
  records = [...records, record];
  return record;
}

export function listStripePaymentLinksForWorkspace(workspaceId: string): StripePaymentLinkRecord[] {
  return records.filter((record) => record.workspace_id === workspaceId).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function markStripePaymentLinkDeactivated(id: string): StripePaymentLinkRecord | null {
  const existing = records.find((record) => record.id === id);
  if (!existing) return null;
  const updated: StripePaymentLinkRecord = { ...existing, deactivated_at: nowIso() };
  records = records.map((record) => (record.id === id ? updated : record));
  return updated;
}

/** Every active, real (not-yet-deactivated) link whose tracked `expires_at` has already passed — what a caller deactivates for real via `deactivatePaymentLink`. */
export function listExpiredActiveStripePaymentLinks(workspaceId: string): StripePaymentLinkRecord[] {
  const now = Date.now();
  return records.filter((record) => record.workspace_id === workspaceId && !record.deactivated_at && record.expires_at && new Date(record.expires_at).getTime() <= now);
}
