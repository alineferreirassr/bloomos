"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { generateId, nowIso } from "@/lib/data/utils";

import { getWorkspaceLayout, saveWorkspaceLayout } from "@/lib/data/mock/workspaceLayoutStore";
import { readWorkspaceFavorites, writeWorkspaceFavorites } from "@/lib/data/mock/workspaceFavoritesStore";
import { readWorkspaceRecentItems, writeWorkspaceRecentItems } from "@/lib/data/mock/workspaceRecentItemsStore";

import { defaultWorkspaceWidgets, isKnownWidgetId } from "@/core/workspace/widgetRegistry";
import { findFavorite, removeFavoriteById, sortFavoritesByRecency, sortFavoritesByPinnedThenRecency, togglePinned } from "@/core/workspace/favoritesEngine";
import { recordRecentItem, sortRecentItemsByRecency } from "@/core/workspace/recentItemsEngine";
import { summarizeActivityFeed } from "@/core/workspace/activityFeedEngine";
import { aggregateWorkspaceHealth, type WorkspaceHealthInput } from "@/core/workspace/workspaceHealthEngine";
import { topRecommendations } from "@/core/workspace/recommendationsEngine";
import { listWorkspaceQuickActions } from "@/core/workspace/quickActionsRegistry";

import { runSearch } from "@/core/search/pipeline";
import type { SearchResult } from "@/core/search/types";
import type { EntityType } from "@/core/enums/entityType";

import { getActivityFeedData } from "@/modules/communication/activityFeed/getActivityFeedData";
import { evaluateOperationsCenterAction } from "@/modules/operationsCenter/operationsCenterActions";
import { evaluatePlatformAction as evaluateDigitalAssetsPlatformAction } from "@/modules/digitalAssets/digitalAssetsActions";
import { listProposalSummariesAction } from "@/modules/proposalPlatform/proposalPlatformActions";
import { listContractSummariesAction } from "@/modules/contractPlatform/contractPlatformActions";
import { listInvoiceSummariesAction } from "@/modules/invoicePlatform/invoicePlatformActions";
import { listClientJourneysAction } from "@/modules/clientJourney/clientJourneyActions";
import { evaluateWorkforceCapabilityCoverageAction } from "@/modules/capability/capabilityActions";
import { evaluateExecutiveDecisionsAction } from "@/modules/executiveDecisions/executiveDecisionsActions";
import { getGraphStatsAction, type GraphStats } from "@/modules/knowledgeGraph/knowledgeGraphActions";
import { generateExecutiveBrief } from "@/modules/ai/copilot/briefs/generateExecutiveBrief";
import type { ExecutiveBrief } from "@/modules/ai/copilot/briefs/types";
import { getExecutiveDashboardData, type ExecutiveDashboardData } from "@/modules/analytics/executive/getExecutiveDashboardData";
import { listReportsAction } from "@/modules/reporting/reportingActions";

import type {
  ActivityEntry,
  WorkspaceActivityDigest,
  WorkspaceFavorite,
  WorkspaceHealthSummary,
  WorkspaceLayout,
  WorkspaceQuickAction,
  WorkspaceRecentItem,
  WorkspaceRecommendation,
  WorkspaceWidgetPreference,
} from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 10 — the Smart Workspace Platform's module
 * actions layer. Every read below composes an already-real platform
 * action; the only genuinely new persistence here is widget layout,
 * favorites, and recent items (Step 2's own three stores). See
 * `docs/smart-workspace.md` for the full reuse map.
 */

const GENERIC_ACCESS_ERROR = "The Workspace isn't available. You may not have access to it.";

export type WorkspaceActionResult<T> = { success: true; data: T } | { success: false; error: string };

/** v2.0 Checkpoint 42, Step 16 — the Workspace Home's own slice of the Reporting Platform: just enough to link through, never a re-implementation of `/reports` itself. */
export interface WorkspaceReportsSummary {
  totalReports: number;
  recentReports: { id: string; title: string }[];
}

export interface WorkspaceSummary {
  layout: WorkspaceLayout;
  favorites: WorkspaceFavorite[];
  recentItems: WorkspaceRecentItem[];
  health: WorkspaceHealthSummary;
  activityDigest: WorkspaceActivityDigest;
  recentActivity: ActivityEntry[];
  recommendations: WorkspaceRecommendation[];
  quickActions: WorkspaceQuickAction[];
  graphStats: GraphStats | null;
  executiveBrief: ExecutiveBrief | null;
  analytics: ExecutiveDashboardData | null;
  reportsSummary: WorkspaceReportsSummary | null;
  generatedAt: string;
}

/** One sub-fetch failing (e.g. a missing granular permission) degrades that one section rather than failing the whole Workspace Home. */
function unwrap<T>(result: { success: true; data: T } | { success: false; error: string }, fallback: T): T {
  return result.success ? result.data : fallback;
}

function deriveFirstName(fullName: string | null | undefined): string | null {
  return fullName?.trim().split(/\s+/)[0] ?? null;
}

export async function getWorkspaceSummaryAction(): Promise<WorkspaceActionResult<WorkspaceSummary>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;

  const storedLayout = getWorkspaceLayout(workspaceId, memberId);
  const layout: WorkspaceLayout = storedLayout ?? { workspace_id: workspaceId, member_id: memberId, widgets: defaultWorkspaceWidgets(), updated_at: new Date(0).toISOString() };

  const favorites = sortFavoritesByRecency(readWorkspaceFavorites().filter((f) => f.workspace_id === workspaceId && f.member_id === memberId));
  const recentItems = sortRecentItemsByRecency(readWorkspaceRecentItems().filter((r) => r.workspace_id === workspaceId && r.member_id === memberId));

  const [activityResult, operationsResult, assetsResult, proposalsResult, contractsResult, invoicesResult, journeysResult, capabilityResult, executiveResult, graphStatsResult, executiveBrief, analyticsResult, reportsResult] = await Promise.all([
    getActivityFeedData({}),
    evaluateOperationsCenterAction(),
    evaluateDigitalAssetsPlatformAction(),
    listProposalSummariesAction(),
    listContractSummariesAction(),
    listInvoiceSummariesAction(),
    listClientJourneysAction(),
    evaluateWorkforceCapabilityCoverageAction(),
    evaluateExecutiveDecisionsAction(),
    getGraphStatsAction(),
    generateExecutiveBrief(workspaceId, deriveFirstName(session.profile?.full_name)),
    getExecutiveDashboardData(),
    listReportsAction(),
  ]);

  const activityEntries = unwrap(activityResult, [] as ActivityEntry[]);
  const activityDigest = summarizeActivityFeed(activityEntries);

  const healthInput: WorkspaceHealthInput = {
    operationalHealthScore: operationsResult.success ? operationsResult.data.health.overallOperationsCenterHealth : 100,
    assetHealth: assetsResult.success ? { score: assetsResult.data.health.averageScore, band: assetsResult.data.health.band } : null,
    proposalHealthScores: proposalsResult.success ? proposalsResult.data.map((p) => p.overallHealthScore) : [],
    contractHealthScores: contractsResult.success ? contractsResult.data.map((c) => c.overallHealthScore) : [],
    invoiceHealthScores: invoicesResult.success ? invoicesResult.data.map((i) => i.overallHealthScore) : [],
    journeyHealthScores: journeysResult.success ? journeysResult.data.map((j) => j.overallHealth) : [],
    capabilityGaps: capabilityResult.success
      ? { uncoveredRequirementCount: capabilityResult.data.coverage.uncoveredRequirementIds.length, highRiskGapsCount: capabilityResult.data.coverage.highRiskGapsCount }
      : { uncoveredRequirementCount: 0, highRiskGapsCount: 0 },
  };

  const health = aggregateWorkspaceHealth(workspaceId, healthInput, nowIso());
  const recommendations = executiveResult.success ? topRecommendations(executiveResult.data.queue, 8) : [];
  const graphStats = graphStatsResult.success ? graphStatsResult.data : null;
  const reportsSummary: WorkspaceReportsSummary | null = reportsResult.success
    ? { totalReports: reportsResult.data.length, recentReports: reportsResult.data.slice(0, 5).map((r) => ({ id: r.id, title: r.title })) }
    : null;

  const summary: WorkspaceSummary = {
    layout,
    favorites,
    recentItems,
    health,
    activityDigest,
    recentActivity: activityEntries.slice(0, 20),
    recommendations,
    quickActions: listWorkspaceQuickActions(),
    graphStats,
    reportsSummary,
    executiveBrief,
    analytics: analyticsResult.success ? analyticsResult.data : null,
    generatedAt: nowIso(),
  };

  return { success: true, data: summary };
}

export async function saveWorkspaceLayoutAction(widgets: WorkspaceWidgetPreference[]): Promise<WorkspaceActionResult<WorkspaceLayout>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.customize")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (widgets.some((w) => !isKnownWidgetId(w.widgetId))) return { success: false, error: "Unknown widget id." };

  const layout = saveWorkspaceLayout(session.workspace.id, session.membership.id, widgets);
  return { success: true, data: layout };
}

export async function resetWorkspaceLayoutAction(): Promise<WorkspaceActionResult<WorkspaceLayout>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.customize")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const layout = saveWorkspaceLayout(session.workspace.id, session.membership.id, defaultWorkspaceWidgets());
  return { success: true, data: layout };
}

/** Toggles a favorite on/off for the signed-in member and returns their full, updated favorites list. */
export async function toggleFavoriteAction(entityType: EntityType, entityId: string, label: string, href: string): Promise<WorkspaceActionResult<WorkspaceFavorite[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.customize")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;
  const all = readWorkspaceFavorites();
  const mine = all.filter((f) => f.workspace_id === workspaceId && f.member_id === memberId);
  const others = all.filter((f) => !(f.workspace_id === workspaceId && f.member_id === memberId));

  const existing = findFavorite(mine, entityType, entityId);
  const nextMine = existing
    ? removeFavoriteById(mine, existing.id)
    : [...mine, { id: generateId("wsfav"), workspace_id: workspaceId, member_id: memberId, entity_type: entityType, entity_id: entityId, label, href, created_at: nowIso(), pinned: false }];

  writeWorkspaceFavorites([...others, ...nextMine]);
  return { success: true, data: sortFavoritesByPinnedThenRecency(nextMine) };
}

/** v2.0 Checkpoint 40 — flips `pinned` on one of the signed-in member's own favorites. */
export async function togglePinnedFavoriteAction(favoriteId: string): Promise<WorkspaceActionResult<WorkspaceFavorite[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.customize")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;
  const all = readWorkspaceFavorites();
  const mine = togglePinned(
    all.filter((f) => f.workspace_id === workspaceId && f.member_id === memberId),
    favoriteId,
  );
  const others = all.filter((f) => !(f.workspace_id === workspaceId && f.member_id === memberId));

  writeWorkspaceFavorites([...others, ...mine]);
  return { success: true, data: sortFavoritesByPinnedThenRecency(mine) };
}

export async function removeFavoriteAction(favoriteId: string): Promise<WorkspaceActionResult<WorkspaceFavorite[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.customize")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;
  const all = readWorkspaceFavorites();
  const mine = removeFavoriteById(
    all.filter((f) => f.workspace_id === workspaceId && f.member_id === memberId),
    favoriteId,
  );
  const others = all.filter((f) => !(f.workspace_id === workspaceId && f.member_id === memberId));

  writeWorkspaceFavorites([...others, ...mine]);
  return { success: true, data: sortFavoritesByRecency(mine) };
}

/**
 * Records that the signed-in member opened (or, v2.0 Checkpoint 40, edited)
 * an entity — called from entity detail pages, not a user-initiated
 * action, so it only requires `workspace.view`. `action` defaults to
 * `"view"` so every pre-Checkpoint-40 call site keeps compiling unchanged.
 */
export async function recordRecentItemAction(
  entityType: EntityType,
  entityId: string,
  label: string,
  href: string,
  action: "view" | "edit" = "view",
): Promise<WorkspaceActionResult<WorkspaceRecentItem[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const workspaceId = session.workspace.id;
  const memberId = session.membership.id;
  const all = readWorkspaceRecentItems();
  const mine = all.filter((r) => r.workspace_id === workspaceId && r.member_id === memberId);
  const others = all.filter((r) => !(r.workspace_id === workspaceId && r.member_id === memberId));

  const entry: WorkspaceRecentItem = {
    id: generateId("wsrecent"),
    workspace_id: workspaceId,
    member_id: memberId,
    entity_type: entityType,
    entity_id: entityId,
    label,
    href,
    viewed_at: nowIso(),
    visit_count: 0,
    action,
  };
  const nextMine = recordRecentItem(mine, entry);

  writeWorkspaceRecentItems([...others, ...nextMine]);
  return { success: true, data: sortRecentItemsByRecency(nextMine) };
}

/** Global Search — the one entry point into `runSearch()` (`core/search/pipeline.ts`), the same pipeline the Command Palette and Bloom AI Copilot already call. */
export async function searchWorkspaceAction(term: string, entityTypes?: EntityType[]): Promise<WorkspaceActionResult<SearchResult[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("workspace.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const results = await runSearch({ workspaceId: session.workspace.id, term, entityTypes, limit: 20 });
  return { success: true, data: results };
}
