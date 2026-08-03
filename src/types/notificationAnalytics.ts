/**
 * v2.0 Checkpoint 41 — Notification Center. Same "engine returns a flat
 * metrics object, view formats it, never recomputes" discipline
 * `types/searchAnalytics.ts` (Checkpoint 40) established. `averageResponseSeconds`
 * is `null`, not fabricated, whenever no notification in the input set has
 * both a `created_at` and a `read_at` — see `notificationAnalyticsEngine.ts`'s
 * own doc comment.
 */
export type NotificationAnalyticsTrend = "improving" | "steady" | "declining";

export interface NotificationAnalytics {
  totalCreated: number;
  totalRead: number;
  totalUnread: number;
  totalDismissed: number;
  totalArchived: number;
  totalPinned: number;
  totalHighPriority: number;
  averageResponseSeconds: number | null;
  averageNotificationAgeSeconds: number;
  deliveryReadinessRate: number;
  engagementRate: number;
  trend: NotificationAnalyticsTrend;
  byCategory: Record<string, number>;
  byKind: Record<string, number>;
  evaluatedAt: string;
}
