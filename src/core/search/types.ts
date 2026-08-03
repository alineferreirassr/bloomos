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

/**
 * v2.0 Checkpoint 40 — every field below `score` is additive and optional,
 * so every existing `SearchProvider` (`workspaceSearchProvider.ts`) and every
 * existing caller (`CommandPalette.tsx`, `CopilotPanel.tsx`,
 * `GlobalSearchWidget.tsx`) keeps compiling and working unchanged. A
 * provider that doesn't populate a given field simply means the Global
 * Search Command Center can't filter/preview on it for that entity type yet
 * — never a fabricated value standing in for one the provider didn't supply.
 */
export interface SearchResult {
  entityType: EntityType;
  entityId: string;
  title: string;
  snippet?: string;
  route: string;
  score?: number;
  /** Design-token icon name, mirroring `WorkspaceQuickAction.icon` — never a raw component reference. */
  icon?: string;
  status?: string;
  owner?: string;
  tags?: string[];
  /** ISO 8601 — the record's own last-updated timestamp, when the provider's underlying entity carries one. */
  lastUpdatedAt?: string;
  /** 0–100 — only set when the entity type has a real, already-computed health/readiness score to reuse (never a new one calculated here). */
  health?: number;
  archived?: boolean;
}

export interface SearchQuery {
  workspaceId: string;
  term: string;
  entityTypes?: EntityType[];
  limit?: number;
  filters?: SearchResultFilters;
}

/**
 * Every field is an intersection (AND) against `SearchResult`'s own optional
 * preview fields above — a filter naming a field a given result never
 * populated simply excludes that result, the same "can't filter on data
 * that was never honestly there" discipline `SearchResult`'s own doc
 * comment states.
 */
export interface SearchResultFilters {
  entityTypes?: EntityType[];
  modules?: string[];
  statuses?: string[];
  tags?: string[];
  owners?: string[];
  archived?: boolean;
  /** Inclusive ISO 8601 bounds against `lastUpdatedAt`. */
  updatedAfter?: string;
  updatedBefore?: string;
  minHealth?: number;
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
