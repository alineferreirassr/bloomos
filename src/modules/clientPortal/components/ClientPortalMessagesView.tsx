"use client";

import { useEffect, useState } from "react";
import { getClientPortalMessages, sendClientPortalMessageAsClient, markClientPortalThreadReadForCurrentSession, logClientPortalActivityForCurrentSession } from "@/lib/data";
import type { ClientPortalMessage } from "@/types/clientPortalMessage";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; messages: ClientPortalMessage[] };

/**
 * Step 8's own messaging interface — a single conversation between the
 * client and the Workspace (no thread list this phase, matching
 * `ClientPortalMessageThread`'s own "one thread per Client Account" doc
 * comment). No realtime: this page loads once and offers an explicit
 * Refresh button, never a websocket or polling loop, per this
 * checkpoint's own non-goal. Attachments and a typing indicator are both
 * inert, explicitly-disabled placeholders, matching Step 8's own wording.
 */
export function ClientPortalMessagesView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const fetchMessages = () =>
    getClientPortalMessages()
      .then((messages) => setState({ status: "ready", messages }))
      .catch(() => setState({ status: "error" }));

  useEffect(() => {
    fetchMessages();
    markClientPortalThreadReadForCurrentSession();

  }, []);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    const result = await sendClientPortalMessageAsClient(draft);
    setSending(false);
    if (result.success) {
      setDraft("");
      logClientPortalActivityForCurrentSession("message_sent");
      fetchMessages();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-3xl font-semibold text-text">Messages</h1>
        <Button type="button" variant="secondary" onClick={fetchMessages}>
          Refresh
        </Button>
      </div>
      <p className="text-sm text-text-muted">A direct line to your planning team.</p>

      {state.status === "loading" ? (
        <div aria-live="polite" aria-busy="true">
          <Skeleton className="h-64 w-full" />
        </div>
      ) : state.status === "error" ? (
        <ErrorState message="Could not load your messages." onRetry={fetchMessages} />
      ) : (
        <Card>
          {state.messages.length === 0 ? (
            <EmptyState title="No messages yet" description="Send your first message to your planning team below." />
          ) : (
            <ul className="max-h-96 space-y-3 overflow-y-auto" aria-label="Conversation" aria-live="polite">
              {state.messages.map((message) => (
                <li key={message.id} className={`flex ${message.author_type === "client" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-md px-3 py-2 text-sm ${message.author_type === "client" ? "bg-accent/10 text-text" : "bg-text/5 text-text"}`}>
                    <p className="text-[11px] font-medium text-text-muted">{message.author_type === "client" ? "You" : (message.author_name ?? "Team")}</p>
                    <p className="mt-0.5">{message.body}</p>
                    <time dateTime={message.created_at} className="mt-1 block text-[10px] text-text-muted">
                      {new Date(message.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-xs italic text-text-muted/70">Real-time typing indicators aren&rsquo;t available yet.</p>
            <div className="flex flex-wrap items-end gap-2">
              <label htmlFor="message-draft" className="sr-only">
                Write a message
              </label>
              <textarea
                id="message-draft"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Write a message…"
                rows={2}
                className="min-w-0 flex-1 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-text"
              />
              <Button type="button" variant="ghost" disabled title="Attachments aren't available yet">
                Attach
              </Button>
              <Button type="button" disabled={sending || !draft.trim()} onClick={handleSend}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
