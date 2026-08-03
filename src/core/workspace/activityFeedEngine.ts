import type { ActivityEntry, WorkspaceActivityDigest } from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 4 — Activity Feed digest. Pure summarization
 * over `ActivityEntry[]` already fetched from `getActivityFeedData()`
 * (Checkpoint 24's Communication Platform, itself backed by
 * `aggregateActivity()` reading the real Timeline store). This engine
 * never fetches anything and never defines a new event/activity concept
 * — it only groups and counts what the real Timeline already recorded.
 */
export function summarizeActivityFeed(entries: ActivityEntry[]): WorkspaceActivityDigest {
  const byDay = new Map<string, number>();
  const byCategory: Record<string, number> = {};

  for (const entry of entries) {
    const day = entry.occurredAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + 1;
  }

  const dayEntries = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return {
    totalEvents: entries.length,
    byDay: dayEntries.map(([date, count]) => ({ date, count })),
    byCategory,
    mostActiveCategory: categoryEntries[0]?.[0] ?? null,
  };
}
