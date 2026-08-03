"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Tabs, TabList, Tab, TabPanel } from "@/components/ui/Tabs";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotificationsIcon } from "@/components/ui/icons";
import {
  getNotificationDashboardDataAction,
  markNotificationReadAction,
  markNotificationUnreadAction,
  pinNotificationAction,
  unpinNotificationAction,
  dismissNotificationAction,
  evaluateNotificationAnalyticsAction,
  evaluateNotificationHealthAction,
  type NotificationDashboardData,
} from "@/modules/notifications/notificationPlatformActions";
import type { Notification, NotificationPriority } from "@/core/notifications/types";
import type { NotificationAnalytics } from "@/types/notificationAnalytics";
import type { NotificationHealthReport } from "@/types/notificationHealth";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: NotificationDashboardData };
type ListFilter = "unread" | "today" | "high_priority" | "pinned" | "archived";

const PRIORITY_TONE: Record<NotificationPriority, BadgeTone> = { low: "outline", normal: "outline", high: "warning", critical: "danger" };

function healthTone(score: number | null): BadgeTone {
  if (score === null) return "neutral";
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

/**
 * v2.0 Checkpoint 41, Step 13 — the Notification Center Dashboard at
 * `/notifications`. Additive to `/communications`'s own `notifications`
 * tab (`NotificationCenterPanel`, Checkpoint 24) — that keeps working
 * unchanged; this is the dedicated, richer surface the checkpoint's own
 * spec calls for (Unread/Today/High Priority/Pinned/Archived list filters
 * plus Analytics/Health/Templates/Preferences/Recent Activity sections),
 * reusing the same `Notification` data and repository, never a second
 * store.
 */
export function NotificationDashboardView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [listFilter, setListFilter] = useState<ListFilter>("unread");
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [health, setHealth] = useState<NotificationHealthReport | null>(null);

  const fetchData = () => {
    getNotificationDashboardDataAction().then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(fetchData, []);
  useEffect(() => {
    evaluateNotificationAnalyticsAction().then((result) => {
      if (result.success) setAnalytics(result.data);
    });
    evaluateNotificationHealthAction().then((result) => {
      if (result.success) setHealth(result.data);
    });
  }, []);

  const filtered = useMemo(() => {
    if (state.status !== "ready") return [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return state.data.notifications.filter((n) => {
      if (listFilter === "unread") return n.read_at === null && n.archived_at === null;
      if (listFilter === "today") return new Date(n.created_at).getTime() >= startOfToday.getTime();
      if (listFilter === "high_priority") return (n.priority === "high" || n.priority === "critical") && n.archived_at === null;
      if (listFilter === "pinned") return n.pinned_at !== null;
      return n.archived_at !== null;
    });
  }, [state, listFilter]);

  async function handleToggleRead(n: Notification) {
    if (n.read_at === null) await markNotificationReadAction(n.id);
    else await markNotificationUnreadAction(n.id);
    fetchData();
  }

  async function handleTogglePin(n: Notification) {
    if (n.pinned_at) await unpinNotificationAction(n.id);
    else await pinNotificationAction(n.id);
    fetchData();
  }

  async function handleDismiss(id: string) {
    await dismissNotificationAction(id);
    fetchData();
  }

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Notifications" subtitle="The single source of truth for every alert BloomOS generates." />
        <TableSkeleton rows={6} columns={2} />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  const { data } = state;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Notifications" subtitle="The single source of truth for every alert BloomOS generates." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Unread" value={String(data.unreadCount)} icon={NotificationsIcon} />
        <KpiCard label="Today" value={String(data.todayCount)} icon={NotificationsIcon} />
        <KpiCard label="High Priority" value={String(data.highPriorityCount)} icon={NotificationsIcon} />
        <KpiCard label="Pinned" value={String(data.pinnedCount)} icon={NotificationsIcon} />
        <KpiCard label="Archived" value={String(data.archivedCount)} icon={NotificationsIcon} />
      </div>

      <Tabs defaultValue="unread">
        <TabList aria-label="Notification sections">
          <Tab value="unread">Unread</Tab>
          <Tab value="today">Today</Tab>
          <Tab value="high_priority">High Priority</Tab>
          <Tab value="pinned">Pinned</Tab>
          <Tab value="archived">Archived</Tab>
          <Tab value="analytics">Analytics</Tab>
          <Tab value="health">Health</Tab>
          <Tab value="templates">Templates</Tab>
          <Tab value="preferences">Preferences</Tab>
          <Tab value="activity">Recent Activity</Tab>
        </TabList>

        {(["unread", "today", "high_priority", "pinned", "archived"] as ListFilter[]).map((f) => (
          <TabPanel key={f} value={f} className="pt-3">
            <NotificationListPanel notifications={f === listFilter ? filtered : []} onEnter={() => setListFilter(f)} onToggleRead={handleToggleRead} onTogglePin={handleTogglePin} onDismiss={handleDismiss} />
          </TabPanel>
        ))}

        <TabPanel value="analytics" className="pt-3">
          {analytics ? <NotificationAnalyticsPanel analytics={analytics} /> : <TableSkeleton rows={4} columns={2} />}
        </TabPanel>

        <TabPanel value="health" className="pt-3">
          {health ? <NotificationHealthPanel health={health} /> : <TableSkeleton rows={4} columns={2} />}
        </TabPanel>

        <TabPanel value="templates" className="pt-3">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-text">Templates</h3>
              <Link href="/notifications/templates" className="text-xs text-accent hover:underline">
                View full library →
              </Link>
            </div>
            <ul className="mt-2 divide-y divide-border text-sm">
              {data.templates.slice(0, 8).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="truncate text-text">{t.name}</span>
                  <Badge tone={PRIORITY_TONE[t.defaultPriority]}>{t.defaultPriority}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </TabPanel>

        <TabPanel value="preferences" className="pt-3">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-serif text-base font-semibold text-text">Preferences</h3>
              <Link href="/notifications/preferences" className="text-xs text-accent hover:underline">
                Edit preferences →
              </Link>
            </div>
            <p className="mt-2 text-sm text-text-muted">Channels, categories, digest frequency, and quiet hours — manage your own notification preferences.</p>
          </Card>
        </TabPanel>

        <TabPanel value="activity" className="pt-3">
          <Card>
            <h3 className="font-serif text-base font-semibold text-text">Recent Activity</h3>
            {data.recentActivity.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">No notification activity recorded yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border text-sm">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-text">{a.description}</span>
                    <span className="shrink-0 text-xs text-text-muted">{formatTimestamp(a.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  );
}

function NotificationListPanel({
  notifications,
  onEnter,
  onToggleRead,
  onTogglePin,
  onDismiss,
}: {
  notifications: Notification[];
  onEnter: () => void;
  onToggleRead: (n: Notification) => void;
  onTogglePin: (n: Notification) => void;
  onDismiss: (id: string) => void;
}) {
  useEffect(onEnter, [onEnter]);

  if (notifications.length === 0) return <EmptyState title="Nothing here" description="Notifications matching this view will appear here." />;

  return (
    <ul className="space-y-2">
      {notifications.map((n) => (
        <li key={n.id} className="flex items-start gap-3 rounded-md border border-border/60 p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={PRIORITY_TONE[n.priority]}>{n.priority}</Badge>
              {n.pinned_at ? <Badge tone="accent">Pinned</Badge> : null}
              <Link href={`/notifications/${n.id}`} className="text-sm font-medium text-text hover:underline">
                {n.title}
              </Link>
            </div>
            <p className="text-sm text-text-muted">{n.body}</p>
            <p className="text-xs text-text-muted">{formatTimestamp(n.created_at)}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="text-xs text-accent hover:underline" onClick={() => onToggleRead(n)}>
              {n.read_at === null ? "Mark read" : "Mark unread"}
            </button>
            <button type="button" className="text-xs text-accent hover:underline" onClick={() => onTogglePin(n)}>
              {n.pinned_at ? "Unpin" : "Pin"}
            </button>
            {n.archived_at === null ? (
              <button type="button" className="text-xs text-danger hover:underline" onClick={() => onDismiss(n.id)}>
                Dismiss
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function NotificationAnalyticsPanel({ analytics }: { analytics: NotificationAnalytics }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Created" value={String(analytics.totalCreated)} icon={NotificationsIcon} />
        <KpiCard label="Read" value={String(analytics.totalRead)} icon={NotificationsIcon} />
        <KpiCard label="Dismissed" value={String(analytics.totalDismissed)} icon={NotificationsIcon} />
        <KpiCard label="High Priority" value={String(analytics.totalHighPriority)} icon={NotificationsIcon} />
        <KpiCard label="Avg. response" value={analytics.averageResponseSeconds !== null ? formatSeconds(analytics.averageResponseSeconds) : "—"} icon={NotificationsIcon} />
        <KpiCard label="Avg. age" value={formatSeconds(analytics.averageNotificationAgeSeconds)} icon={NotificationsIcon} />
        <KpiCard label="Delivery readiness" value={`${Math.round(analytics.deliveryReadinessRate * 100)}%`} icon={NotificationsIcon} />
        <KpiCard label="Engagement" value={`${Math.round(analytics.engagementRate * 100)}%`} icon={NotificationsIcon} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif text-base font-semibold text-text">By category</h3>
            <Badge tone={analytics.trend === "improving" ? "success" : analytics.trend === "declining" ? "danger" : "neutral"}>{analytics.trend}</Badge>
          </div>
          <ul className="mt-2 divide-y divide-border text-sm">
            {Object.entries(analytics.byCategory).map(([category, count]) => (
              <li key={category} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate text-text capitalize">{category}</span>
                <span className="shrink-0 text-text-muted">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="font-serif text-base font-semibold text-text">By kind</h3>
          <ul className="mt-2 divide-y divide-border text-sm">
            {Object.entries(analytics.byKind).map(([kind, count]) => (
              <li key={kind} className="flex items-center justify-between gap-2 py-1.5">
                <span className="truncate text-text">{kind.replace(/_/g, " ")}</span>
                <span className="shrink-0 text-text-muted">{count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function NotificationHealthPanel({ health }: { health: NotificationHealthReport }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-serif text-base font-semibold text-text">Notification Health</h3>
        <Badge tone={healthTone(health.overallScore)}>{health.overallScore}/100</Badge>
      </div>
      <ul className="mt-2 divide-y divide-border text-sm">
        {health.categories.map((category) => (
          <li key={category.category} className="flex items-center justify-between gap-2 py-1.5">
            <span className="capitalize text-text">{category.category.replace(/_/g, " ")}</span>
            {category.score !== null ? <Badge tone={healthTone(category.score)}>{category.score}/100</Badge> : <span className="text-xs text-text-muted">{category.notApplicableReason}</span>}
          </li>
        ))}
      </ul>
      {health.findings.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-text-muted">
          {health.findings.map((finding, index) => (
            <li key={index}>{finding.message}</li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
