"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMyGmailInboxAction, type GmailInboxThreadSummary } from "@/modules/integrations/gmail/getGmailInboxActions";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "no_connection" }
  | { status: "not_synced" }
  | { status: "ready"; threads: GmailInboxThreadSummary[] };

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * GMAIL-07 — the read-only Gmail Inbox's thread list. Reads exclusively
 * through `getMyGmailInboxAction` (BloomOS persistence only — see that
 * file's own doc comment for why it never calls the Gmail API). Route-
 * based navigation to `/gmail-inbox/[threadId]` for the conversation
 * view, mirroring `UnifiedInboxView.tsx`'s own "list page + separate
 * detail page" shape rather than a split-pane, per this checkpoint's own
 * "prefer route-based navigation over new state management" guidance —
 * this also means desktop and mobile need no separate layouts.
 */
export function GmailInboxView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = () => {
    setState({ status: "loading" });
    getMyGmailInboxAction().then((result) => {
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      if (result.data.status === "ready") setState({ status: "ready", threads: result.data.threads });
      else setState({ status: result.data.status });
    });
  };

  useEffect(() => {
    let cancelled = false;
    getMyGmailInboxAction().then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      if (result.data.status === "ready") setState({ status: "ready", threads: result.data.threads });
      else setState({ status: result.data.status });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Gmail" subtitle="Your own connected Gmail mailbox — read-only." />

      {state.status === "loading" ? (
        <Skeleton className="h-64 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message="Gmail isn't available right now." onRetry={load} />
      ) : state.status === "no_connection" ? (
        <EmptyState
          illustration="messages"
          title="Connect Gmail to see your inbox here"
          description="Connect your own Gmail account from Integrations to start syncing your mailbox."
          action={
            <Link href="/developer" className="text-sm text-accent underline">
              Go to Integrations
            </Link>
          }
        />
      ) : state.status === "not_synced" ? (
        <EmptyState
          illustration="messages"
          title="Gmail is connected but hasn't synced yet"
          description="Run a sync from Integrations to bring in your mailbox."
          action={
            <Link href="/developer" className="text-sm text-accent underline">
              Go to Integrations
            </Link>
          }
        />
      ) : state.threads.length === 0 ? (
        <EmptyState illustration="messages" title="No messages yet" description="Once your mailbox syncs new mail, it'll show up here." />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-border">
            {state.threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/gmail-inbox/${thread.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 first:rounded-t-lg last:rounded-b-lg hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none sm:px-5 sm:py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`truncate text-sm sm:text-[15px] ${thread.unreadCount > 0 ? "font-semibold text-text" : "font-medium text-text"}`}>{thread.subject ?? "(no subject)"}</p>
                      {thread.unreadCount > 0 ? (
                        <Badge tone="danger">
                          {thread.unreadCount} unread
                        </Badge>
                      ) : null}
                    </div>
                    {thread.snippet ? <p className="truncate text-sm text-text-muted">{thread.snippet}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-xs text-text-muted">{formatTimestamp(thread.latestMessageAt)}</span>
                    <span className="text-[11px] text-text-muted">{thread.messageCount} message{thread.messageCount === 1 ? "" : "s"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
