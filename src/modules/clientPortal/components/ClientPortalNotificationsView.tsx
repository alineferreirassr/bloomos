"use client";

import { useEffect, useState } from "react";
import { getClientPortalNotifications, markClientPortalNotificationRead, logClientPortalActivityForCurrentSession } from "@/lib/data";
import type { Notification } from "@/core/notifications";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; notifications: Notification[] };

/** Step 9's own Notification Center — reuses the real, shared Notification module (`core/notifications`) directly, never a parallel client-only one. */
export function ClientPortalNotificationsView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [pendingId, setPendingId] = useState<string | null>(null);

  const fetchNotifications = () =>
    getClientPortalNotifications()
      .then((notifications) => setState({ status: "ready", notifications }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    fetchNotifications();

  }, []);

  async function handleMarkRead(id: string) {
    setPendingId(id);
    const result = await markClientPortalNotificationRead(id);
    setPendingId(null);
    if (result.success) {
      logClientPortalActivityForCurrentSession("notification_read", id);
      fetchNotifications();
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">Notifications</h1>

      {state.status === "loading" ? (
        <div aria-live="polite" aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your notifications." onRetry={fetchNotifications} />
      ) : state.notifications.length === 0 ? (
        <EmptyState title="No notifications yet" description="You'll see updates about your event here." />
      ) : (
        <ul className="space-y-3">
          {state.notifications.map((notification) => (
            <li key={notification.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-[15px] font-semibold text-text">{notification.title}</h3>
                      {notification.read_at === null ? <Badge tone="accent">New</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-text-muted">{notification.body}</p>
                    <time dateTime={notification.created_at} className="mt-1 block text-xs text-text-muted">
                      {new Date(notification.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </div>
                  {notification.read_at === null ? (
                    <Button type="button" variant="ghost" disabled={pendingId === notification.id} onClick={() => handleMarkRead(notification.id)}>
                      Mark Read
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
