import { getActivitySources } from "@/core/communication/activityRegistry";
import type { ActivityEntry, ActivityQuery } from "@/types/communication";

/**
 * v2.0 Checkpoint 24, Steps 7 & 7.5 — the ActivityAggregator. This is the
 * one engine behind both the workspace-wide Activity Feed (Step 7) and the
 * per-entity Communication Timeline (Step 7.5): the Feed is
 * `aggregateActivity({ workspaceId })` (no owner scope), the Timeline is
 * `aggregateActivity({ workspaceId, ownerType, ownerId })` — same function,
 * different scope. Treating these as one engine at two call shapes (rather
 * than two parallel aggregation functions) is the checkpoint's own
 * "avoid duplicated calculations" architecture decision — see
 * `docs/communication-timeline.md`.
 *
 * Every registered `ActivitySourceAdapter` receives the *full* query and is
 * responsible for its own owner-scoping (most delegate straight to an
 * existing store's own `getTimelineForOwner`/`getRecentActivity`-shaped
 * read). Cross-cutting concerns that don't belong in any one adapter —
 * category filter, free-text search, date range, actor filter, and the
 * final chronological sort — are applied once, here, after every adapter's
 * results are merged. One adapter throwing never breaks the others, the
 * same isolation `computeVisibleMetrics` already applies to Metrics.
 */
export async function aggregateActivity(query: ActivityQuery): Promise<ActivityEntry[]> {
  const adapters = getActivitySources();
  const results = await Promise.allSettled(adapters.map((adapter) => adapter(query)));
  const merged = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));

  const categories = query.categories ? new Set(query.categories) : null;
  const searchTerm = query.search?.trim().toLowerCase() ?? "";
  const fromMs = query.dateFrom ? new Date(query.dateFrom).getTime() : null;
  const toMs = query.dateTo ? new Date(query.dateTo).getTime() : null;

  const filtered = merged.filter((entry) => {
    if (categories && !categories.has(entry.category)) return false;
    if (query.actorMemberId && entry.actorMemberId !== query.actorMemberId) return false;
    if (fromMs !== null && new Date(entry.occurredAt).getTime() < fromMs) return false;
    if (toMs !== null && new Date(entry.occurredAt).getTime() > toMs) return false;
    if (searchTerm.length > 0) {
      const haystack = `${entry.title} ${entry.description ?? ""} ${entry.actorLabel}`.toLowerCase();
      if (!haystack.includes(searchTerm)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.occurredAt.localeCompare(a.occurredAt);
  });
}
