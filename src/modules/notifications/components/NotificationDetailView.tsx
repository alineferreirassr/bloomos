"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { getNotificationDetailAction, type NotificationDetailData } from "@/modules/notifications/notificationPlatformActions";
import type { NotificationPriority } from "@/core/notifications/types";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: NotificationDetailData };

const PRIORITY_TONE: Record<NotificationPriority, BadgeTone> = { low: "outline", normal: "outline", high: "warning", critical: "danger" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * v2.0 Checkpoint 41, Step 14 — Notification Detail at `/notifications/[id]`.
 * "Analytics" and "Health" (the spec's own Step 14 wording) are workspace-
 * wide composites, not a per-notification metric — fabricating a per-item
 * number for either would be dishonest, so this view links to the
 * Dashboard's own Analytics/Health tabs instead of inventing one.
 */
export function NotificationDetailView({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    getNotificationDetailAction(id).then((result) => {
      if (result.success) setState({ status: "ready", data: result.data });
      else setState({ status: "error", message: result.error });
    });
  }, [id]);

  if (state.status === "loading") {
    return (
      <div>
        <PageHeader title="Notification" breadcrumb={[{ label: "Notifications", href: "/notifications" }, { label: "Detail" }]} />
        <TableSkeleton rows={5} columns={2} />
      </div>
    );
  }
  if (state.status === "error") return <ErrorState message={state.message} />;

  const { notification, routing, preferenceDecision, template, timeline, knowledgeGraphSummary } = state.data;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={notification.title} subtitle={notification.body} breadcrumb={[{ label: "Notifications", href: "/notifications" }, { label: "Detail" }]} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <LuxuryCard>
          <h3 className="font-serif text-base font-semibold text-text">Metadata</h3>
          <dl className="mt-2 space-y-2 text-sm sm:space-y-1.5">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Priority</dt>
              <dd>
                <Badge tone={PRIORITY_TONE[notification.priority]}>{notification.priority}</Badge>
              </dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Category</dt>
              <dd className="text-text capitalize">{routing.category}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Kind</dt>
              <dd className="text-text">{notification.kind ?? "—"}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Created</dt>
              <dd className="text-text">{formatDateTime(notification.created_at)}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Read</dt>
              <dd className="text-text">{notification.read_at ? formatDateTime(notification.read_at) : "Unread"}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Pinned</dt>
              <dd className="text-text">{notification.pinned_at ? formatDateTime(notification.pinned_at) : "No"}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Archived</dt>
              <dd className="text-text">{notification.archived_at ? formatDateTime(notification.archived_at) : "No"}</dd>
            </div>
          </dl>
        </LuxuryCard>

        <LuxuryCard>
          <h3 className="font-serif text-base font-semibold text-text">Routing & future delivery</h3>
          <dl className="mt-2 space-y-2 text-sm sm:space-y-1.5">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Visible</dt>
              <dd className="text-text">{routing.visible ? "Yes" : routing.suppressedReason}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Expires</dt>
              <dd className="text-text">{routing.expiresAt ? formatDateTime(routing.expiresAt) : "Never"}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Quiet hours</dt>
              <dd className="text-text">{preferenceDecision.withinQuietHours ? "Currently active" : "Not active"}</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
              <dt className="text-text-muted">Effective digest</dt>
              <dd className="text-text capitalize">{preferenceDecision.effectiveDigestFrequency}</dd>
            </div>
          </dl>
          <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Channel readiness</h4>
          <ul className="mt-1 space-y-1 text-sm">
            {routing.deliveryReadiness.map((r) => (
              <li key={r.channel} className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="text-text capitalize">{r.channel.replace(/_/g, " ")}</span>
                <Badge tone={r.configured ? "success" : "neutral"}>{r.configured ? "Ready" : "Not configured"}</Badge>
              </li>
            ))}
          </ul>
        </LuxuryCard>

        <LuxuryCard>
          <h3 className="font-serif text-base font-semibold text-text">Template</h3>
          {template ? (
            <div className="mt-2 space-y-1 text-sm">
              <p className="text-text">{template.name}</p>
              <p className="text-text-muted">{template.description}</p>
              <Link href="/notifications/templates" className="text-xs text-accent hover:underline">
                View Template Library →
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-text-muted">No template is associated with this notification.</p>
          )}
        </LuxuryCard>

        <LuxuryCard>
          <h3 className="font-serif text-base font-semibold text-text">Knowledge Graph</h3>
          <p className="mt-2 text-sm text-text-muted">{knowledgeGraphSummary}</p>
        </LuxuryCard>
      </div>

      <LuxuryCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-serif text-base font-semibold text-text">Timeline & history</h3>
          <div className="flex flex-wrap gap-3 text-xs">
            <Link href="/notifications" className="text-accent hover:underline">
              Dashboard Analytics →
            </Link>
            <Link href="/notifications" className="text-accent hover:underline">
              Dashboard Health →
            </Link>
          </div>
        </div>
        {timeline.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No timeline events recorded yet for this notification.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {timeline.map((event) => (
              <li key={event.id} className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                <span className="text-text">{event.description}</span>
                <span className="shrink-0 text-xs text-text-muted">{formatDateTime(event.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </LuxuryCard>
    </div>
  );
}
