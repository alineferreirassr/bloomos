import type { EntityType } from "@/core/enums/entityType";

/**
 * How one entity type participates in global search. `route` is optional
 * and omitted for a reserved-but-unbuilt module (Inventory, Vendors) — there
 * is no page to link to yet, so a config entry says "this type will be
 * searchable" without pretending a route already exists.
 */
export interface SearchableEntityConfig {
  entityType: EntityType;
  /** Singular display label, e.g. "Lead". */
  label: string;
  /** Grouping label for a future results UI, e.g. "CRM", "Finance". */
  module: string;
  route?: (id: string) => string;
}

export interface SearchResult {
  entityType: EntityType;
  entityId: string;
  title: string;
  snippet?: string;
  route: string;
  score?: number;
}

export interface SearchQuery {
  workspaceId: string;
  term: string;
  entityTypes?: EntityType[];
  limit?: number;
}

/**
 * Dependency inversion for search execution — the registry (`registry.ts`)
 * says WHAT is searchable; a `SearchProvider` says HOW to actually search
 * it. No indexing implementation exists this phase (see `service.ts`'s
 * `NullSearchProvider`); a real one (Postgres full-text search, a hosted
 * search service) slots in later by implementing this same interface.
 */
export interface SearchProvider {
  search(query: SearchQuery): Promise<SearchResult[]>;
}
