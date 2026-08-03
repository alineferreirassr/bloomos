import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2 Checkpoint 23 — the Client ↔ Stripe Customer id mapping. BloomOS's
 * own `Client` type has no external-id column (confirmed by this
 * checkpoint's own research — `email`/`phone`/`address` only), so this
 * is a new, small, parallel mapping store, the same "new entity, not a
 * modification of an existing one" precedent `IntegrationConnection`
 * (Checkpoint 22) already set relative to Marketplace's
 * `ConnectorInstallation`. Mock-only, unconditionally, same rationale as
 * every other Checkpoint 22/23 store.
 */
export interface StripeCustomerMapping {
  id: string;
  workspace_id: string;
  client_id: string;
  stripe_customer_id: string;
  created_at: string;
  updated_at: string;
}

let mappings: StripeCustomerMapping[] = [];

export function resetStripeCustomerMappingStore(): void {
  mappings = [];
}

export function getStripeCustomerMappingByClientId(clientId: string): StripeCustomerMapping | null {
  return mappings.find((mapping) => mapping.client_id === clientId) ?? null;
}

export function getClientIdForStripeCustomer(stripeCustomerId: string): string | null {
  return mappings.find((mapping) => mapping.stripe_customer_id === stripeCustomerId)?.client_id ?? null;
}

/** Insert-or-touch — the one place a Client's Stripe Customer id is ever recorded, so "prevent duplicates" (Step 3's own requirement) is structural: a second sync for the same Client always finds this mapping first. */
export function upsertStripeCustomerMapping(workspaceId: string, clientId: string, stripeCustomerId: string): StripeCustomerMapping {
  const existing = getStripeCustomerMappingByClientId(clientId);
  const now = nowIso();
  if (existing) {
    const updated: StripeCustomerMapping = { ...existing, stripe_customer_id: stripeCustomerId, updated_at: now };
    mappings = mappings.map((mapping) => (mapping.id === existing.id ? updated : mapping));
    return updated;
  }
  const created: StripeCustomerMapping = { id: generateId("stripe-customer-mapping"), workspace_id: workspaceId, client_id: clientId, stripe_customer_id: stripeCustomerId, created_at: now, updated_at: now };
  mappings = [...mappings, created];
  return created;
}
