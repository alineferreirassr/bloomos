import { NOTIFICATION_CHANNELS, type Notification } from "@/core/notifications/types";
import { isChannelConfigured } from "@/core/notifications/registry";
import { NOTIFICATION_KIND_META } from "@/core/communication/notificationEngine";
import type { NotificationAnalytics, NotificationAnalyticsTrend } from "@/types/notificationAnalytics";

/**
 * v2.0 Checkpoint 41, Step 7 — Notification Analytics Engine. Pure —
 * every metric is derived from the `Notification[]` the caller already
 * fetched, following the same "engine returns numbers, view formats them"
 * discipline `core/search/searchAnalyticsEngine.ts` established.
 *
 * `totalDismissed` is an honest alias for `totalArchived`: `Notification`
 * has no separate `dismissed_at` field — the Notification Center's own
 * "Undo dismiss" affordance (`undoArchiveNotificationAction`) is undoing
 * an archive, not a distinct dismissal state. Fabricating a second count
 * that always equals the first would be worse than naming the alias
 * explicitly, which is what this engine does.
 */

const ENGAGEMENT_TREND_THRESHOLD = 5;

function engagementRate(notifications: Notification[]): number {
  if (notifications.length === 0) return 0;
  return notifications.filter((n) => n.read_at !== null).length / notifications.length;
}

/** Splits by creation order (not calendar time — this engine has no fixed period boundary), compares the older half's engagement to the newer half's. Fewer than 4 notifications is too small a sample to call a trend either way. */
function computeTrend(notifications: Notification[]): NotificationAnalyticsTrend {
  if (notifications.length < 4) return "steady";
  const sorted = [...notifications].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const mid = Math.floor(sorted.length / 2);
  const olderRate = engagementRate(sorted.slice(0, mid)) * 100;
  const newerRate = engagementRate(sorted.slice(mid)) * 100;
  if (newerRate - olderRate > ENGAGEMENT_TREND_THRESHOLD) return "improving";
  if (olderRate - newerRate > ENGAGEMENT_TREND_THRESHOLD) return "declining";
  return "steady";
}

export function computeNotificationAnalytics(notifications: Notification[], evaluatedAt: string): NotificationAnalytics {
  const now = new Date(evaluatedAt).getTime();
  const totalCreated = notifications.length;
  const readNotifications = notifications.filter((n) => n.read_at !== null);
  const totalRead = readNotifications.length;
  const totalUnread = notifications.filter((n) => n.read_at === null && n.archived_at === null).length;
  const totalArchived = notifications.filter((n) => n.archived_at !== null).length;
  const totalPinned = notifications.filter((n) => n.pinned_at !== null).length;
  const totalHighPriority = notifications.filter((n) => n.priority === "high" || n.priority === "critical").length;

  const responseTimes = readNotifications.map((n) => (new Date(n.read_at as string).getTime() - new Date(n.created_at).getTime()) / 1000);
  const averageResponseSeconds = responseTimes.length > 0 ? Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length) : null;

  const activeNotifications = notifications.filter((n) => n.archived_at === null);
  const averageNotificationAgeSeconds =
    activeNotifications.length > 0 ? Math.round(activeNotifications.reduce((sum, n) => sum + (now - new Date(n.created_at).getTime()) / 1000, 0) / activeNotifications.length) : 0;

  const configuredChannels = NOTIFICATION_CHANNELS.filter((channel) => isChannelConfigured(channel));

  const byCategory: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  for (const notification of notifications) {
    const category = notification.kind ? NOTIFICATION_KIND_META[notification.kind].defaultCategory : "communication";
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    const kindKey = notification.kind ?? "unknown";
    byKind[kindKey] = (byKind[kindKey] ?? 0) + 1;
  }

  return {
    totalCreated,
    totalRead,
    totalUnread,
    totalDismissed: totalArchived,
    totalArchived,
    totalPinned,
    totalHighPriority,
    averageResponseSeconds,
    averageNotificationAgeSeconds,
    deliveryReadinessRate: configuredChannels.length / NOTIFICATION_CHANNELS.length,
    engagementRate: engagementRate(notifications),
    trend: computeTrend(notifications),
    byCategory,
    byKind,
    evaluatedAt,
  };
}
