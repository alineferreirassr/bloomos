import { registerReportMetric } from "@/core/reporting/metricRegistry";
import { evaluateNotificationAnalyticsAction, evaluateNotificationHealthAction } from "@/modules/notifications/notificationPlatformActions";
import type { ReportMetricDefinition, ReportMetricResult } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42 — Communication category. Wraps the real Notification
 * Analytics/Health Engines (Checkpoint 41) — the only Communication-domain
 * analytics this checkpoint's own Step 0 audit found exposed through a
 * callable action; Comments/Presence/Internal Messaging have no analytics
 * action of their own yet (see `docs/reporting-platform.md`).
 */

function result(value: number | null, unit: ReportMetricResult["unit"]): ReportMetricResult {
  return { value, previousValue: null, unit, series: [], breakdown: [], notApplicableReason: value === null ? "Source action returned no data." : null, stale: false, partial: false };
}

const notificationsCreated: ReportMetricDefinition = {
  id: "communication.notifications_created",
  name: "Notifications Created",
  description: "Total notifications created across the workspace.",
  category: "communication",
  unit: "count",
  aggregation: "count",
  sourceModule: "Notification Center (Checkpoint 41)",
  sourceEngine: "evaluateNotificationAnalyticsAction() — totalCreated",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["notifications.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateNotificationAnalyticsAction();
    return result(r.success ? r.data.totalCreated : null, "count");
  },
};

const notificationEngagementRate: ReportMetricDefinition = {
  id: "communication.notification_engagement_rate",
  name: "Notification Engagement Rate",
  description: "Share of notifications that were read.",
  category: "communication",
  unit: "percent",
  aggregation: "rate",
  sourceModule: "Notification Center (Checkpoint 41)",
  sourceEngine: "evaluateNotificationAnalyticsAction() — engagementRate",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["notifications.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateNotificationAnalyticsAction();
    return result(r.success ? r.data.engagementRate * 100 : null, "percent");
  },
};

const notificationUnreadCount: ReportMetricDefinition = {
  id: "communication.notifications_unread",
  name: "Unread Notifications",
  description: "Notifications currently unread and not archived.",
  category: "communication",
  unit: "count",
  aggregation: "count",
  sourceModule: "Notification Center (Checkpoint 41)",
  sourceEngine: "evaluateNotificationAnalyticsAction() — totalUnread",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["notifications.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateNotificationAnalyticsAction();
    return result(r.success ? r.data.totalUnread : null, "count");
  },
};

const communicationHealthScore: ReportMetricDefinition = {
  id: "communication.health_score",
  name: "Communication Health",
  description: "Overall Notification Health score.",
  category: "communication",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Notification Center (Checkpoint 41)",
  sourceEngine: "evaluateNotificationHealthAction() — overallScore",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["notifications.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Scoped to the Notification domain specifically, not the whole Communication Platform (Comments/Presence/Messaging aren't included) — matches `communication_health`'s own honest scoping in Business Health."],
  async compute() {
    const r = await evaluateNotificationHealthAction();
    return result(r.success ? r.data.overallScore : null, "percent");
  },
};

export function registerCommunicationReportMetrics(): void {
  registerReportMetric(notificationsCreated);
  registerReportMetric(notificationEngagementRate);
  registerReportMetric(notificationUnreadCount);
  registerReportMetric(communicationHealthScore);
}
