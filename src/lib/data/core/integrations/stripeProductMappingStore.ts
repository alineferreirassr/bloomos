import { generateId, nowIso } from "@/lib/data/utils";

/**
 * v2 Checkpoint 23 — the Service ↔ Stripe Product/Price mapping. Same
 * "new, small, parallel entity" rationale as `stripeCustomerMappingStore.ts`:
 * `Service`/`ServiceVersion` have no external-id column. Tracks the
 * *current* Stripe Price alongside which `ServiceVersion` it was minted
 * from — Stripe Prices are immutable, exactly like `ServiceVersion`
 * itself, so a newly published version always gets a brand-new Price,
 * never a mutation of the old one.
 */
export interface StripeProductMapping {
  id: string;
  workspace_id: string;
  service_id: string;
  stripe_product_id: string;
  stripe_price_id: string | null;
  /** Which published `ServiceVersion.id` `stripe_price_id` was minted from — lets a re-sync detect "a new version was published since we last synced" without re-reading price amounts. */
  synced_service_version_id: string | null;
  created_at: string;
  updated_at: string;
}

let mappings: StripeProductMapping[] = [];

export function resetStripeProductMappingStore(): void {
  mappings = [];
}

export function getStripeProductMappingByServiceId(serviceId: string): StripeProductMapping | null {
  return mappings.find((mapping) => mapping.service_id === serviceId) ?? null;
}

export function upsertStripeProductMapping(workspaceId: string, serviceId: string, patch: Partial<Pick<StripeProductMapping, "stripe_product_id" | "stripe_price_id" | "synced_service_version_id">>): StripeProductMapping {
  const existing = getStripeProductMappingByServiceId(serviceId);
  const now = nowIso();
  if (existing) {
    const updated: StripeProductMapping = { ...existing, ...patch, updated_at: now };
    mappings = mappings.map((mapping) => (mapping.id === existing.id ? updated : mapping));
    return updated;
  }
  const created: StripeProductMapping = {
    id: generateId("stripe-product-mapping"),
    workspace_id: workspaceId,
    service_id: serviceId,
    stripe_product_id: patch.stripe_product_id ?? "",
    stripe_price_id: patch.stripe_price_id ?? null,
    synced_service_version_id: patch.synced_service_version_id ?? null,
    created_at: now,
    updated_at: now,
  };
  mappings = [...mappings, created];
  return created;
}
