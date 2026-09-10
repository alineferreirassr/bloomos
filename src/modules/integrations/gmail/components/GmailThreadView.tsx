"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { getMyGmailThreadAction, type GmailInboxMessageView } from "@/modules/integrations/gmail/getGmailInboxActions";
import type { GmailEmailAddress } from "@/core/integrations/gmail/types";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "not_found" }
  | { status: "all_deleted" }
  | { status: "ready"; subject: string | null; messages: GmailInboxMessageView[] };

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatAddress(address: GmailEmailAddress | null): string {
  if (!address) return "";
  return address.name ? `${address.name} <${address.email}>` : address.email;
}

function formatAddressList(addresses: GmailEmailAddress[]): string {
  return addresses.map(formatAddress).join(", ");
}

/**
 * GMAIL-07 — one message's read-only body. Rendering priority exactly
 * matches `getGmailInboxActions.ts`'s own DTO shape: `sanitizedBodyHtml`
 * (already sanitized server-side — see `gmailHtmlSanitizer.ts`, never
 * the raw provider HTML) first, `bodyText` next, then an explicit empty
 * state. There is deliberately no third "snippet" fallback here — a
 * snippet is a truncated preview meant for the thread list row, not a
 * message's own body; showing it here would misrepresent a partial
 * string as the real message content.
 */
function MessageBody({ message }: { message: GmailInboxMessageView }) {
  if (message.sanitizedBodyHtml && message.sanitizedBodyHtml.trim().length > 0) {
    return (
      // sanitizedBodyHtml is produced exclusively by gmailHtmlSanitizer.ts server-side — never raw provider HTML.
      <div
        className="gmail-body max-w-full overflow-x-auto text-sm leading-relaxed break-words text-text [&_a]:text-accent [&_a]:underline [&_table]:max-w-full [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1"
        dangerouslySetInnerHTML={{ __html: message.sanitizedBodyHtml }}
      />
    );
  }
  if (message.bodyText && message.bodyText.trim().length > 0) {
    return <p className="max-w-full overflow-x-auto text-sm leading-relaxed break-words whitespace-pre-wrap text-text">{message.bodyText}</p>;
  }
  return <p className="text-sm text-text-muted italic">This message has no readable content.</p>;
}

export function GmailThreadView({ threadId }: { threadId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const load = () => {
    setState({ status: "loading" });
    getMyGmailThreadAction(threadId).then((result) => {
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      if (result.data.status === "ready") setState({ status: "ready", subject: result.data.subject, messages: result.data.messages });
      else setState({ status: result.data.status });
    });
  };

  useEffect(() => {
    let cancelled = false;
    getMyGmailThreadAction(threadId).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        setState({ status: "error" });
        return;
      }
      if (result.data.status === "ready") setState({ status: "ready", subject: result.data.subject, messages: result.data.messages });
      else setState({ status: result.data.status });
    });
    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const subtitle = state.status === "ready" ? (state.subject ?? "(no subject)") : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="Conversation" subtitle={subtitle} breadcrumb={[{ label: "Gmail", href: "/gmail-inbox" }, { label: "Conversation" }]} />

      {state.status === "loading" ? (
        <Skeleton className="h-64 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message="This conversation isn't available right now." onRetry={load} />
      ) : state.status === "not_found" ? (
        <EmptyState illustration="messages" title="Conversation not found" description="It may not exist, or it isn't yours to view." />
      ) : state.status === "all_deleted" ? (
        <EmptyState illustration="messages" title="This conversation has been deleted" description="Every message in this conversation was removed in Gmail." />
      ) : (
        <ul className="space-y-4">
          {state.messages.map((message) => (
            <li key={message.id}>
              <Card>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">{formatAddress(message.fromAddress) || "(unknown sender)"}</p>
                    {message.toAddresses.length > 0 ? <p className="truncate text-xs text-text-muted">To: {formatAddressList(message.toAddresses)}</p> : null}
                    {message.ccAddresses.length > 0 ? <p className="truncate text-xs text-text-muted">Cc: {formatAddressList(message.ccAddresses)}</p> : null}
                  </div>
                  <time dateTime={message.internalDate ?? undefined} className="shrink-0 text-xs text-text-muted">
                    {formatTimestamp(message.internalDate)}
                  </time>
                </div>
                <div className="mt-3">
                  <MessageBody message={message} />
                </div>
                {message.hasAttachments ? <p className="mt-3 text-xs text-text-muted">This message has an attachment (not shown here).</p> : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
