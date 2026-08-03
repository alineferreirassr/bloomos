import { getService, getServiceVersion } from "@/lib/data";
import { getStripeProviderForWorkspace } from "@/core/integrations/providers/stripe/stripeClient";
import { getStripeProductMappingByServiceId, upsertStripeProductMapping, type StripeProductMapping } from "@/lib/data/core/integrations/stripeProductMappingStore";
import { getLogger } from "@/core/observability/logger";

/**
 * Products & Prices synchronization (v2 Checkpoint 23, Step 4). A
 * BloomOS `Service` (the stable catalog identity) maps to a real Stripe
 * Product; its *current published* `ServiceVersion` maps to a real
 * Stripe Price. Stripe Prices are immutable — exactly like
 * `ServiceVersion` itself — so "a price update" is never a mutation: it
 * archives the old Price and mints a new one, tracked via
 * `synced_service_version_id` so a re-sync only does real work when the
 * published version actually changed.
 */

const ARCHIVED_SERVICE_STATUSES = new Set(["archived", "inactive"]);

export interface SyncServiceResult {
  mapping: StripeProductMapping;
  archived: boolean;
}

export async function syncServiceToStripeProduct(workspaceId: string, serviceId: string): Promise<SyncServiceResult> {
  const service = await getService(serviceId);
  const provider = await getStripeProviderForWorkspace(workspaceId);
  const existingMapping = getStripeProductMappingByServiceId(serviceId);
  const metadata = { bloomos_service_id: service.id, bloomos_workspace_id: workspaceId };

  if (ARCHIVED_SERVICE_STATUSES.has(service.status)) {
    if (existingMapping) {
      await provider.archiveProduct(existingMapping.stripe_product_id);
      if (existingMapping.stripe_price_id) await provider.archivePrice(existingMapping.stripe_price_id);
      getLogger().info("Stripe product archived", { workspaceId, serviceId });
      return { mapping: existingMapping, archived: true };
    }
    // Never synced and already archived/inactive — nothing to do.
    return { mapping: upsertStripeProductMapping(workspaceId, serviceId, {}), archived: true };
  }

  let mapping = existingMapping;
  if (!mapping) {
    const product = await provider.createProduct({ name: service.name, description: service.description ?? undefined, metadata });
    mapping = upsertStripeProductMapping(workspaceId, serviceId, { stripe_product_id: product.id });
  } else {
    await provider.updateProduct(mapping.stripe_product_id, { name: service.name, description: service.description ?? undefined, active: true });
  }

  const needsNewPrice = service.current_published_version_id && service.current_published_version_id !== mapping.synced_service_version_id;
  if (needsNewPrice && service.current_published_version_id) {
    const version = await getServiceVersion(service.current_published_version_id);
    if (mapping.stripe_price_id) await provider.archivePrice(mapping.stripe_price_id);
    const price = await provider.createPrice({ productId: mapping.stripe_product_id, unitAmountMinor: version.base_price_minor, currency: version.currency, metadata: { bloomos_service_version_id: version.id } });
    mapping = upsertStripeProductMapping(workspaceId, serviceId, { stripe_price_id: price.id, synced_service_version_id: version.id });
  }

  getLogger().info("Stripe product synchronized", { workspaceId, serviceId, stripeProductId: mapping.stripe_product_id, priceRefreshed: Boolean(needsNewPrice) });
  return { mapping, archived: false };
}

export function getExistingStripeProductMapping(serviceId: string): StripeProductMapping | null {
  return getStripeProductMappingByServiceId(serviceId);
}
