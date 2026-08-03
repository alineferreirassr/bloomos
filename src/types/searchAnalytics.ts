import type { EntityType } from "@/core/enums/entityType";

/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. Every
 * field here is computed from data two already-real stores already hold —
 * `SearchHistoryEntry[]` (this checkpoint's own new store) and
 * `WorkspaceRecentItem[]`/`WorkspaceFavorite[]` (Checkpoint 38) — never a
 * third tracking store. `core/search/searchAnalyticsEngine.ts` is the one
 * place these are computed.
 */
export interface SearchAnalyticsSummary {
  totalSearches: number;
  mostSearchedTerms: { term: string; count: number }[];
  mostSearchedEntityTypes: { entityType: EntityType; count: number }[];
  mostSearchedCommands: { commandId: string; count: number }[];
  noResultSearches: { term: string; searched_at: string }[];
  noResultRate: number;
  averageResultCount: number;
  successRate: number;
  mostOpenedResult: { entity_type: EntityType; entity_id: string; label: string; visit_count: number } | null;
  mostPinnedResult: { entity_type: EntityType; entity_id: string; label: string } | null;
  evaluatedAt: string;
}
