"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUnifiedInboxData } from "@/modules/communication/inbox/getUnifiedInboxData";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { InboxItem } from "@/types/communication";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: InboxItem[] };

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * v2.0 Checkpoint 24, Step 4 — the Unified Inbox. "Every future provider
 * should feed this inbox" (spec) — see `getUnifiedInboxData.ts`'s own doc
 * comment for exactly how a third source would be added here without
 * changing this component.
 */
export function UnifiedInboxView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const router = useRouter();

  const fetchData = () => {
    getUnifiedInboxData().then((result) => {
      if (result.success) setState({ status: "ready", items: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(fetchData, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Inbox" subtitle="Every conversation across the workspace, in one place." />
      {state.status === "loading" ? (
        <Skeleton className="h-64 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={fetchData} />
      ) : state.items.length === 0 ? (
        <EmptyState title="Your inbox is empty" description="Start a conversation with a teammate to see it here." />
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {state.items.map((item) => (
              <li
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(item.href)}
                onKeyDown={(e) => (e.key === "Enter" ? router.push(item.href) : undefined)}
                className="flex cursor-pointer items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-surface-hover"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {item.pinned ? <Badge tone="accent">Pinned</Badge> : null}
                    <p className="truncate text-sm font-medium text-text">{item.participantLabel}</p>
                    {item.unreadCount > 0 ? <Badge tone="danger">{item.unreadCount}</Badge> : null}
                  </div>
                  {item.previewBody ? <p className="truncate text-sm text-text-muted">{item.previewBody}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-text-muted">{formatTimestamp(item.lastMessageAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
