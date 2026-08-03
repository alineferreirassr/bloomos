import type { EntityType } from "@/core/enums/entityType";
import type { SearchableEntityConfig } from "@/core/search/types";

/**
 * What's searchable, decoupled from how search executes — a module
 * registers itself here once (see `defaultRegistrations.ts` for today's
 * set), and any future `SearchProvider` can enumerate the registry instead
 * of every module needing to know about every search implementation.
 */
const registry = new Map<EntityType, SearchableEntityConfig>();

export function registerSearchableEntity(config: SearchableEntityConfig): void {
  registry.set(config.entityType, config);
}

export function getSearchableEntities(): SearchableEntityConfig[] {
  return [...registry.values()];
}

export function getSearchableEntityConfig(entityType: EntityType): SearchableEntityConfig | undefined {
  return registry.get(entityType);
}

export function isEntitySearchable(entityType: EntityType): boolean {
  return registry.has(entityType);
}
