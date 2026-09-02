"use client";

import { useEffect, useMemo, useState } from "react";
import { getNotificationCenterData } from "@/modules/communication/notifications/getNotificationsData";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  pinNotificationAction,
  unpinNotificationAction,
  archiveNotificationAction,
  undoArchiveNotificationAction,
} from "@/modules/communication/notifications/notificationActions";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs, TabList, Tab } from "@/components/ui/Tabs";
import type { Notification, NotificationPriority } from "@/core/notifications/types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; notifications: Notification[] };
type ViewFilter = "unread" | "read" | "archived" | "pinned";

/** Compact ghost-button treatment for inline row actions — same hover/active states as `Button variant="ghost"`, sized down for a single row (matching the `!px-1.5 text-xs`/`!px-2 text-xs` precedent already used elsewhere for compact ghost buttons, e.g. `WidgetCard`/`FavoritesWidget`). */
const ROW_ACTION_CLASS = "!px-2 !py-1 text-xs";
/** The rarer/destructive row action (Archive) gets the same compact ghost treatment but in the danger hue, so it reads as available without competing with the row's primary action (Mark read). */
const ROW_ACTION_DANGER_CLASS = "!px-2 !py-1 text-xs !text-danger hover:!bg-danger/10 active:!bg-danger/18";

const PRIORITY_TONE: Record<NotificationPriority, BadgeTone> = { low: "outline", normal: "outline", high: "warning", critical: "danger" };

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * v2.0 Checkpoint 24, Step 1 — the Notification Center. Unread/Read/Archived/Pinned
 * are client-side view filters over one already-fetched, per-member array
 * (a member's own notification volume is small and bounded — no
 * server-side pagination needed at this scale, matching
 * `getNotificationCenterData`'s own doc comment). "Undo Dismiss" is a real,
 * repository-backed reversal (`undoArchiveNotificationAction`), not a
 * client-only optimistic illusion.
 */
export function NotificationCenterPanel() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filter, setFilter] = useState<ViewFilter>("unread");
  const [search, setSearch] = useState("");
  const [lastArchivedId, setLastArchivedId] = useState<string | null>(null);

  const fetchData = () => {
    getNotificationCenterData().then((result) => {
      if (result.success) setState({ status: "ready", notifications: result.data.notifications });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(fetchData, []);

  const filtered = useMemo(() => {
    if (state.status !== "ready") return [];
    return state.notifications.filter((n) => {
      if (filter === "unread" && (n.read_at !== null || n.archived_at !== null)) return false;
      if (filter === "read" && (n.read_at === null || n.archived_at !== null)) return false;
      if (filter === "archived" && n.archived_at === null) return false;
      if (filter === "pinned" && n.pinned_at === null) return false;
      if (search.trim() && !`${n.title} ${n.body}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [state, filter, search]);

  async function handleMarkRead(id: string) {
    await markNotificationReadAction(id);
    fetchData();
  }

  async function handleMarkAllRead() {
    await markAllNotificationsReadAction();
    fetchData();
  }

  async function handleTogglePin(n: Notification) {
    if (n.pinned_at) await unpinNotificationAction(n.id);
    else await pinNotificationAction(n.id);
    fetchData();
  }

  async function handleArchive(id: string) {
    await archiveNotificationAction(id);
    setLastArchivedId(id);
    fetchData();
  }

  async function handleUndo() {
    if (!lastArchivedId) return;
    await undoArchiveNotificationAction(lastArchivedId);
    setLastArchivedId(null);
    fetchData();
  }

  if (state.status === "loading") return <Skeleton className="h-64 w-full" />;
  if (state.status === "error") return <ErrorState message={state.message} onRetry={fetchData} />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as ViewFilter)} className="min-w-0 flex-1">
          <TabList aria-label="Notification filter">
            {(["unread", "read", "pinned", "archived"] as ViewFilter[]).map((f) => (
              <Tab key={f} value={f} className="capitalize">
                {f}
              </Tab>
            ))}
          </TabList>
        </Tabs>
        <div className="flex shrink-0 items-center gap-2">
          {lastArchivedId ? (
            <Button type="button" variant="ghost" className={ROW_ACTION_CLASS} onClick={handleUndo}>
              Undo dismiss
            </Button>
          ) : null}
          <Button onClick={handleMarkAllRead} className="text-xs">
            Mark all read
          </Button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search notifications…"
        aria-label="Search notifications"
        className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
      />

      {filtered.length === 0 ? (
        <EmptyState illustration="messages" title="Nothing here" description="Notifications matching this filter will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <LuxuryCard key={n.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:p-5">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={PRIORITY_TONE[n.priority]}>{n.priority}</Badge>
                  {n.pinned_at ? <Badge tone="accent">Pinned</Badge> : null}
                  <p className="text-sm font-medium text-text">{n.title}</p>
                </div>
                <p className="text-sm text-text-muted">{n.body}</p>
                <p className="text-xs text-text-muted">{formatTimestamp(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1">
                {n.read_at === null ? (
                  <Button type="button" variant="ghost" className={ROW_ACTION_CLASS} onClick={() => handleMarkRead(n.id)}>
                    Mark read
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" className={ROW_ACTION_CLASS} onClick={() => handleTogglePin(n)}>
                  {n.pinned_at ? "Unpin" : "Pin"}
                </Button>
                {n.archived_at === null ? (
                  <Button type="button" variant="ghost" className={ROW_ACTION_DANGER_CLASS} onClick={() => handleArchive(n.id)}>
                    Archive
                  </Button>
                ) : null}
              </div>
            </LuxuryCard>
          ))}
        </div>
      )}
    </div>
  );
}
