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
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Notification, NotificationPriority } from "@/core/notifications/types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; notifications: Notification[] };
type ViewFilter = "unread" | "read" | "archived" | "pinned";

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Notification filter">
          {(["unread", "read", "pinned", "archived"] as ViewFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${filter === f ? "bg-accent text-accent-foreground" : "bg-surface-hover text-text-muted"}`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {lastArchivedId ? (
            <button type="button" className="text-xs text-accent hover:underline" onClick={handleUndo}>
              Undo dismiss
            </button>
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
        <EmptyState title="Nothing here" description="Notifications matching this filter will appear here." />
      ) : (
        <ul className="space-y-2">
          {filtered.map((n) => (
            <li key={n.id} className="flex items-start gap-3 rounded-md border border-border/60 p-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={PRIORITY_TONE[n.priority]}>{n.priority}</Badge>
                  {n.pinned_at ? <Badge tone="accent">Pinned</Badge> : null}
                  <p className="text-sm font-medium text-text">{n.title}</p>
                </div>
                <p className="text-sm text-text-muted">{n.body}</p>
                <p className="text-xs text-text-muted">{formatTimestamp(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                {n.read_at === null ? (
                  <button type="button" className="text-xs text-accent hover:underline" onClick={() => handleMarkRead(n.id)}>
                    Mark read
                  </button>
                ) : null}
                <button type="button" className="text-xs text-accent hover:underline" onClick={() => handleTogglePin(n)}>
                  {n.pinned_at ? "Unpin" : "Pin"}
                </button>
                {n.archived_at === null ? (
                  <button type="button" className="text-xs text-danger hover:underline" onClick={() => handleArchive(n.id)}>
                    Archive
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
