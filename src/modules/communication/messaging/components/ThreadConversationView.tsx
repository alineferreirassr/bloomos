"use client";

import { useEffect, useState } from "react";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { getThreadMessagesAction, sendMessageAction, markThreadReadAction } from "@/modules/communication/messaging/messagingActions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import type { InternalMessage } from "@/types/communication";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; messages: InternalMessage[] };

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * v2.0 Checkpoint 24, Step 12 — Internal Messaging's own conversation view.
 * Read Receipts are real (`read_by_member_ids`, rendered as "Seen" once
 * every other participant has read a message). Typing Indicator is
 * intentionally NOT implemented — no realtime transport exists anywhere in
 * BloomOS (the same non-goal Client Portal Messages, Checkpoint 14, already
 * established), and a fake one would violate this codebase's own "no
 * placeholder features presented as real" discipline. See
 * `docs/notification-engine.md`'s Known Limitations.
 */
export function ThreadConversationView({ threadId }: { threadId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [body, setBody] = useState("");
  const session = useMemberSession();

  const fetchData = () => {
    getThreadMessagesAction(threadId).then((result) => {
      if (result.success) setState({ status: "ready", messages: result.data });
      else setState({ status: "error", message: result.error });
    });
  };

  useEffect(() => {
    markThreadReadAction(threadId).then(fetchData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  async function handleSend() {
    if (body.trim().length === 0) return;
    const result = await sendMessageAction(threadId, body);
    if (result.success) {
      setBody("");
      fetchData();
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Conversation" />
      {state.status === "loading" ? (
        <Skeleton className="h-64 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={fetchData} />
      ) : (
        <ul className="space-y-2">
          {state.messages.map((m) => {
            const mine = m.author_member_id === session.membership?.id;
            return (
              <li key={m.id} className={`max-w-[80%] rounded-md border border-border/60 p-2.5 ${mine ? "ml-auto bg-surface-tint" : ""}`}>
                <p className="text-sm text-text">{m.body}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {m.author_name} · {formatTimestamp(m.created_at)}
                  {mine && m.read_by_member_ids.length > 1 ? " · Seen" : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex gap-2">
        <label htmlFor="message-body" className="sr-only">
          Message
        </label>
        <input
          id="message-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => (e.key === "Enter" ? handleSend() : undefined)}
          placeholder="Type a message…"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:border-accent focus-visible:outline-none"
        />
        <Button onClick={handleSend} disabled={body.trim().length === 0}>
          Send
        </Button>
      </div>
    </div>
  );
}
