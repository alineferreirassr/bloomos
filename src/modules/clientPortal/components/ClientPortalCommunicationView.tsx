"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalCommunicationSummaryAction, type ClientPortalCommunicationSummary } from "@/modules/clientPortal/getClientPortalCommunicationSummary";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; summary: ClientPortalCommunicationSummary };

/**
 * Checkpoint 36, Step 7 — the Communication Center. Composes Messages,
 * Notifications, Announcements, and Comments — every field comes from
 * `getClientPortalCommunicationSummaryAction`, itself composing
 * already-existing accessors (see that file's own doc comment for what's
 * reused vs. genuinely new, and why "Mentions" has no client-safe
 * equivalent). The Unified Communication Timeline is the existing
 * `/client-access/timeline` page — linked to here, never duplicated.
 */
export function ClientPortalCommunicationView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchSummary = () =>
    getClientPortalCommunicationSummaryAction().then((result) => {
      if (result.success) setState({ status: "ready", summary: result.data });
      else setState({ status: "error" });
    });

  useEffect(() => {
    fetchSummary();

  }, []);

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold text-text">Communication Center</h1>
      <p className="text-sm text-text-muted">Everything you&rsquo;ve heard from us, and everything we&rsquo;ve heard from you.</p>

      {state.status === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your communication center." onRetry={fetchSummary} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link href="/client-access/messages">
              <Card className="transition-colors hover:border-accent/50">
                <p className="text-xs text-text-muted">Messages</p>
                <p className="mt-1 text-2xl font-semibold text-text">{state.summary.unreadMessageCount}</p>
                <p className="text-xs text-text-muted">unread</p>
              </Card>
            </Link>
            <Link href="/client-access/notifications">
              <Card className="transition-colors hover:border-accent/50">
                <p className="text-xs text-text-muted">Notifications</p>
                <p className="mt-1 text-2xl font-semibold text-text">{state.summary.unreadNotificationCount}</p>
                <p className="text-xs text-text-muted">unread</p>
              </Card>
            </Link>
            <Link href="/client-access/timeline">
              <Card className="transition-colors hover:border-accent/50">
                <p className="text-xs text-text-muted">Unified Timeline</p>
                <p className="mt-1 text-sm font-medium text-text">Every update, in one place</p>
                <p className="text-xs text-text-muted">View timeline →</p>
              </Card>
            </Link>
          </div>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Announcements</h2>
            {state.summary.announcements.length === 0 ? (
              <EmptyState title="No announcements" description="Announcements from your planning team will appear here." />
            ) : (
              <ul role="list" className="space-y-3">
                {state.summary.announcements.map((announcement) => (
                  <li key={announcement.id} className="rounded-md border border-border p-3">
                    <p className="text-sm font-medium text-text">{announcement.title}</p>
                    <p className="mt-1 text-sm text-text-muted">{announcement.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="mb-2 font-serif text-[15px] font-semibold text-text">Comments</h2>
            <p className="mb-3 text-xs text-text-muted">Notes exchanged on your contracts and documents.</p>
            {state.summary.recentComments.length === 0 ? (
              <EmptyState title="No comments yet" description="Comments on your contracts and documents will appear here." />
            ) : (
              <ul role="list" className="space-y-3">
                {state.summary.recentComments.map((comment) => (
                  <li key={comment.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-text">{comment.author}</p>
                      <Badge tone="neutral">{comment.ownerLabel}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">{comment.body}</p>
                    <p className="mt-1 text-xs text-text-muted">{new Date(comment.createdAt).toLocaleDateString()}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
