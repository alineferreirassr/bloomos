"use client";

import { useEffect, useState } from "react";
import { getClientAccountsByClientId, getClientPortalActivityForAccount } from "@/lib/data";
import type { ClientPortalActivity, ClientPortalActivityKind } from "@/types/clientPortalActivity";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; activity: ClientPortalActivity[] };

const ACTIVITY_KIND_LABELS: Record<ClientPortalActivityKind, string> = {
  login: "Logged in",
  document_viewed: "Viewed a document",
  document_downloaded: "Downloaded a document",
  invoice_viewed: "Viewed an invoice",
  timeline_viewed: "Opened their Timeline",
  notification_read: "Read a notification",
  checklist_item_completed: "Completed a task",
  message_sent: "Sent a message",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

interface ClientPortalActivitySectionProps {
  clientId: string;
}

/**
 * Checkpoint 36, Step 17 — internal-team read-only view of a client's own
 * Client Portal Activity log, embedded on Client Detail alongside
 * ClientAccessSection. Reuses the same Activity log Checkpoint 14 already
 * writes to (`listClientPortalActivity`) — no new tracking mechanism.
 * Gated by `client_portal.view`; hidden entirely without it, the same
 * "hide the whole card" precedent ClientAccessSection established.
 */
export function ClientPortalActivitySection({ clientId }: ClientPortalActivitySectionProps) {
  const { can } = useMemberSession();
  const canView = can("client_portal.view");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    getClientAccountsByClientId(clientId)
      .then((accounts) => {
        if (accounts.length === 0) return [];
        const account = accounts[0];
        return getClientPortalActivityForAccount(account.workspace_id, account.id);
      })
      .then((activity) => {
        if (!cancelled) setState({ status: "ready", activity });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, canView]);

  if (!canView) return null;

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Client Portal Activity</h3>

      {state.status === "loading" ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : state.status === "error" ? (
        <p className="mt-3 text-xs text-text-muted">Could not load Client Portal activity.</p>
      ) : state.activity.length === 0 ? (
        <p className="mt-3 text-xs text-text-muted">No Client Portal activity yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {state.activity.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs">
              <span className="text-text">
                {ACTIVITY_KIND_LABELS[entry.kind]}
                {entry.entity_label ? `: ${entry.entity_label}` : ""}
              </span>
              <span className="text-text-muted">{formatDateTime(entry.occurred_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
