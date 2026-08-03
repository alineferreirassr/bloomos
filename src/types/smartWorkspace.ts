import type { EntityType } from "@/core/enums/entityType";
import type { Decision } from "@/types/executiveDecisions";
import type { ActivityEntry } from "@/types/communication";

/**
 * v2.0 Checkpoint 38 — Smart Workspace Platform. Named `smartWorkspace.ts`,
 * not `workspace.ts` — that file already holds the base tenant `Workspace`
 * entity (`id`/`name`/`slug`, the row every `session.workspace` resolves
 * to), a completely different concept from the unified home/dashboard this
 * checkpoint builds. Reusing the filename would have meant overwriting a
 * foundational type used across the entire codebase.
 *
 * This file defines only what's genuinely new: widget layout, favorites,
 * recent items, quick actions, and a workspace-wide health composite.
 * Everything else the Workspace surfaces — search results, activity
 * entries, recommendations, knowledge graph stats — is a direct type
 * reuse of an already-real type from another checkpoint (see the imports
 * above and the aliases below), never a redefinition of the same shape
 * under a new name.
 */

// ---------------------------------------------------------------------------
// Widgets & Layout
// ---------------------------------------------------------------------------

export const WORKSPACE_WIDGET_TYPES = [
  "executive_overview",
  "business_overview",
  "operational_overview",
  "analytics_overview",
  "activity_feed",
  "global_search",
  "favorites",
  "recent_items",
  "quick_actions",
  "workspace_health",
  "knowledge_graph",
  "recommendations",
  "reports_overview",
] as const;

export type WorkspaceWidgetType = (typeof WORKSPACE_WIDGET_TYPES)[number];

export const WORKSPACE_WIDGET_LABELS: Record<WorkspaceWidgetType, string> = {
  executive_overview: "Executive Overview",
  business_overview: "Business Overview",
  operational_overview: "Operational Overview",
  analytics_overview: "Analytics Overview",
  activity_feed: "Activity Feed",
  global_search: "Global Search",
  favorites: "Favorites",
  recent_items: "Recent Items",
  quick_actions: "Quick Actions",
  workspace_health: "Workspace Health",
  knowledge_graph: "Knowledge Graph",
  recommendations: "Recommendations",
  reports_overview: "Reports",
};

export const WORKSPACE_WIDGET_DESCRIPTIONS: Record<WorkspaceWidgetType, string> = {
  executive_overview: "Top priority decisions from the Executive Decision queue.",
  business_overview: "The Business Health orchestrator's own overall score and category breakdown.",
  operational_overview: "The Operations Center's composed operational health.",
  analytics_overview: "Revenue, pipeline, and event KPIs from Executive Analytics & BI.",
  activity_feed: "The real, workspace-wide Timeline, aggregated across every module.",
  global_search: "Search leads, clients, events, contracts, invoices, documents, assets, team, and vendors at once.",
  favorites: "Entities you've pinned for quick access.",
  recent_items: "Entities you've opened recently.",
  quick_actions: "One-click shortcuts into existing creation flows.",
  workspace_health: "One composite score built from every platform's own Health Engine.",
  knowledge_graph: "Live stats from the real Knowledge Graph, linking through to the full Explorer.",
  recommendations: "The Executive Decisions queue's next-best-actions, reused here as a widget.",
  reports_overview: "Your most recently saved reports, linking through to the full Reporting Center.",
};

/**
 * Mirrors `DashboardWidgetPreference`/`DashboardLayout` from
 * `types/businessIntelligence.ts` (Checkpoint 23, Step 14) exactly — same
 * shape, same per-member scoping, a new instance of the same pattern
 * rather than a shared store, matching how every platform in this codebase
 * repeats an established pattern instead of centralizing it into one
 * cross-platform table.
 */
export interface WorkspaceWidgetPreference {
  widgetId: WorkspaceWidgetType;
  pinned: boolean;
  hidden: boolean;
  order: number;
}

export interface WorkspaceLayout {
  workspace_id: string;
  member_id: string;
  widgets: WorkspaceWidgetPreference[];
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Favorites & Recent Items — genuinely new: no cross-entity version of
// either concept existed before this checkpoint (only Digital Assets' own
// scoped `AssetFavorite` from Checkpoint 37).
// ---------------------------------------------------------------------------

export interface WorkspaceFavorite {
  id: string;
  workspace_id: string;
  member_id: string;
  entity_type: EntityType;
  entity_id: string;
  label: string;
  href: string;
  created_at: string;
  /**
   * v2.0 Checkpoint 40 — Global Search & Universal Command Center. A pinned
   * favorite is the same row, just promoted to always sort first — never a
   * second store. Defaults `false`; every pre-Checkpoint-40 favorite reads
   * as unpinned without a migration.
   */
  pinned: boolean;
}

export interface WorkspaceRecentItem {
  id: string;
  workspace_id: string;
  member_id: string;
  entity_type: EntityType;
  entity_id: string;
  label: string;
  href: string;
  viewed_at: string;
  /**
   * v2.0 Checkpoint 40 — incremented (never reset) every time this same
   * entity is recorded again, powering "Most Visited" as a sort over this
   * one list rather than a second visit-tracking store. Starts at `1`.
   */
  visit_count: number;
  /**
   * v2.0 Checkpoint 40 — `"edit"` when the caller just mutated this entity
   * (not merely viewed it), powering "Recently Edited" as a filter over
   * this same list. Optional and defaults to `"view"` for any caller that
   * doesn't distinguish — never fabricated when the caller doesn't know.
   */
  action?: "view" | "edit";
}

// ---------------------------------------------------------------------------
// Quick Actions — a static registry of shortcuts into real, existing
// creation flows. Never new business logic: every entry just navigates to
// a route a prior checkpoint already built.
// ---------------------------------------------------------------------------

export interface WorkspaceQuickAction {
  id: string;
  label: string;
  description: string;
  group: string;
  href: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// Workspace Health — a composite over every platform's own already-computed
// health/score output. Some platforms expose a native {score, band} pair;
// others expose only findings/severity counts or per-entity scores that
// need averaging. Both cases are disclosed per-entry via `isProxy` and
// `sourceAction`, the same disclosure precedent
// `operationsCenterHealthEngine.ts` itself sets for its own proxy scores.
// ---------------------------------------------------------------------------

export const WORKSPACE_HEALTH_BANDS = ["excellent", "good", "attention", "critical"] as const;
export type WorkspaceHealthBand = (typeof WORKSPACE_HEALTH_BANDS)[number];

export interface WorkspacePlatformHealthEntry {
  key: string;
  label: string;
  score: number;
  band: WorkspaceHealthBand;
  sourceAction: string;
  isProxy: boolean;
}

export interface WorkspaceHealthSummary {
  workspace_id: string;
  overallScore: number;
  band: WorkspaceHealthBand;
  platforms: WorkspacePlatformHealthEntry[];
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Activity Feed digest — a pure summarization layer over the real,
// already-aggregated `ActivityEntry[]` from `aggregateActivity()`
// (Checkpoint 24's Communication Platform). No new fetch, no new event
// system — see `core/workspace/activityFeedEngine.ts`.
// ---------------------------------------------------------------------------

export interface WorkspaceActivityDayCount {
  date: string;
  count: number;
}

export interface WorkspaceActivityDigest {
  totalEvents: number;
  byDay: WorkspaceActivityDayCount[];
  byCategory: Record<string, number>;
  mostActiveCategory: string | null;
}

export type { ActivityEntry };

// ---------------------------------------------------------------------------
// Recommendations — a direct alias onto the real Executive Decisions queue
// (`Decision`), which is itself already the composition of ~19 platforms'
// own recommendation sources. The Workspace widget renders the top of this
// same queue; it never re-derives a second one.
// ---------------------------------------------------------------------------

export type WorkspaceRecommendation = Decision;

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface WorkspaceSearchGroup {
  entityType: EntityType;
  label: string;
  module: string;
  count: number;
}
