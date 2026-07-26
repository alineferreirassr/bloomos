import { listServices, listServiceCategories, getServiceVersion, getServiceUsageCounts } from "@/lib/data";
import { getServiceHealth } from "@/lib/queries/services/health";
import type { ServicesCatalogFilters, ServicesCatalogResult, ServiceCatalogRow } from "@/lib/queries/services/types";

const SORT_COMPARATORS: Record<NonNullable<ServicesCatalogFilters["sortBy"]>, (a: ServiceCatalogRow, b: ServiceCatalogRow) => number> = {
  name: (a, b) => a.service.name.localeCompare(b.service.name),
  health: (a, b) => b.health.percent - a.health.percent,
  usage: (a, b) => b.usageCount - a.usageCount,
  updatedAt: (a, b) => b.service.updated_at.localeCompare(a.service.updated_at),
};

/**
 * Composes one catalog row per Service: category name (joined in-memory,
 * not a second round trip per row), the draft/published version summaries
 * a card needs for price display, health, and now `usageCount` — fetched
 * for the WHOLE page in exactly one `getServiceUsageCounts` call
 * (`serviceIds` collected up front), never one usage lookup per row. The
 * `usage`/`sortBy` filter dimensions only exist here — they're never passed
 * down to `listServices`, since honoring them requires the usage counts
 * this function alone has just computed.
 */
export async function getServicesCatalog(filters: ServicesCatalogFilters = {}): Promise<ServicesCatalogResult> {
  const { usage, sortBy, ...serviceFilters } = filters;
  const [services, categories] = await Promise.all([listServices(serviceFilters), listServiceCategories(true)]);
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));
  const usageCounts = await getServiceUsageCounts(services.map((service) => service.id));

  let rows: ServiceCatalogRow[] = await Promise.all(
    services.map(async (service) => {
      const [draftVersion, publishedVersion, health] = await Promise.all([
        service.draft_version_id ? getServiceVersion(service.draft_version_id) : null,
        service.current_published_version_id ? getServiceVersion(service.current_published_version_id) : null,
        getServiceHealth(service.id),
      ]);
      if (!draftVersion) {
        // Defensive only — every Service always has a draft version.
        throw new Error(`Service ${service.id} has no draft version.`);
      }
      return {
        service,
        categoryName: service.category_id ? (categoryNameById.get(service.category_id) ?? null) : null,
        draftVersion,
        publishedVersion,
        health,
        usageCount: usageCounts[service.id] ?? 0,
      };
    }),
  );

  if (usage === "assigned") rows = rows.filter((row) => row.usageCount > 0);
  else if (usage === "unassigned") rows = rows.filter((row) => row.usageCount === 0);

  if (sortBy) rows = [...rows].sort(SORT_COMPARATORS[sortBy]);

  return { rows, categories };
}

/** Thin wrapper — search is just the catalog's own `search` filter, never a second, divergent matching implementation. */
export async function searchServices(query: string, options: { limit?: number; usage?: ServicesCatalogFilters["usage"]; sortBy?: ServicesCatalogFilters["sortBy"] } = {}): Promise<ServiceCatalogRow[]> {
  const { limit, ...catalogFilters } = options;
  const { rows } = await getServicesCatalog({ search: query, ...catalogFilters });
  return limit ? rows.slice(0, limit) : rows;
}
