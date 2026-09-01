"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientPortalThreadDetailAction, type ClientPortalThreadDetail } from "@/modules/communication/inbox/clientPortalThreadActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ClientPortalMessage } from "@/types/clientPortalMessage";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; detail: ClientPortalThreadDetail };

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Groups consecutive messages from the same author so the Client/Staff label renders once per group, matching `ThreadConversationView`'s own grouping convention. */
interface MessageGroup {
  authorType: ClientPortalMessage["author_type"];
  authorName: string | null;
  messages: ClientPortalMessage[];
}

function groupMessagesByAuthor(messages: ClientPortalMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const previous = groups[groups.length - 1];
    if (previous && previous.authorType === message.author_type) {
      previous.messages.push(message);
    } else {
      groups.push({ authorType: message.author_type, authorName: message.author_name, messages: [message] });
    }
  }
  return groups;
}

/**
 * Phase 09C.2 — read-only staff view of a Client Portal message thread,
 * reached from the Unified Inbox. Deliberately has no reply input: this
 * codebase has no staff→client reply capability yet (see
 * `getClientPortalThreadDetailAction`'s doc comment), so this view never
 * implies one exists. Reuses `ThreadConversationView`'s own message-bubble
 * visual language rather than inventing a second one.
 */
export function ClientPortalThreadView({ threadId }: { threadId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const fetchData = () => {
    getClientPortalThreadDetailAction(threadId).then((result) => {
      if (result.success) setState({ status: "ready", detail: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const groups = state.status === "ready" ? groupMessagesByAuthor(state.detail.messages) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title={state.status === "ready" ? state.detail.thread.subject : "Conversation"}
        subtitle="Client Portal conversation"
        breadcrumb={[{ label: "Inbox", href: "/inbox" }, { label: "Conversation" }]}
        actions={
          state.status === "ready" && state.detail.clientId ? (
            <Link href={`/clients/${state.detail.clientId}`} className="text-xs font-medium text-accent hover:underline">
              View client
            </Link>
          ) : undefined
        }
      />
      {state.status === "loading" ? (
        <Skeleton className="h-64 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={fetchData} />
      ) : groups.length === 0 ? (
        <EmptyState title="No messages yet" description="This conversation doesn't have any messages." illustration="messages" />
      ) : (
        <ul className="space-y-4">
          {groups.map((group, index) => (
            <li
              key={`${group.authorType}-${index}`}
              className={`flex flex-col gap-1 ${group.authorType === "staff" ? "items-end" : "items-start"}`}
            >
              <p className="px-1 text-xs font-medium text-text-muted">
                {group.authorType === "staff" ? (group.authorName ?? "Staff") : "Client"}
              </p>
              {group.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%] ${
                    group.authorType === "staff" ? "bg-surface-tint text-text" : "border border-border/60 bg-surface text-text"
                  }`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[11px] text-text-muted ${group.authorType === "staff" ? "text-right" : "text-left"}`}>
                    {formatTimestamp(m.created_at)}
                  </p>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
