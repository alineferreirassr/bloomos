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

/** One or more consecutive messages from the same author, grouped so the sender's name renders once per group instead of once per message. Purely a rendering grouping — never changes what was fetched or sent. */
interface MessageGroup {
  authorMemberId: string;
  authorName: string;
  mine: boolean;
  messages: InternalMessage[];
}

function groupMessagesByAuthor(messages: InternalMessage[], myMemberId: string | undefined): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const previous = groups[groups.length - 1];
    if (previous && previous.authorMemberId === message.author_member_id) {
      previous.messages.push(message);
    } else {
      groups.push({
        authorMemberId: message.author_member_id,
        authorName: message.author_name,
        mine: message.author_member_id === myMemberId,
        messages: [message],
      });
    }
  }
  return groups;
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
  const myMemberId = session.membership?.id;

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

  /**
   * `ThreadConversationView` only ever receives a bare `threadId` — no
   * thread/participant object is fetched or passed in. The only source of
   * "who am I talking to" is the `author_name` already present on each
   * loaded `InternalMessage`, so the header subtitle is derived from that
   * real, already-fetched data (no new server action, no invented name). If
   * the other participant hasn't sent a message yet, no name can be shown —
   * the header simply omits the subtitle rather than guessing.
   */
  const otherParticipantNames =
    state.status === "ready"
      ? Array.from(new Set(state.messages.filter((m) => m.author_member_id !== myMemberId).map((m) => m.author_name)))
      : [];
  const subtitle = otherParticipantNames.length > 0 ? `With ${otherParticipantNames.join(", ")}` : undefined;

  const groups = state.status === "ready" ? groupMessagesByAuthor(state.messages, myMemberId) : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Conversation"
        subtitle={subtitle}
        breadcrumb={[{ label: "Inbox", href: "/inbox" }, { label: "Conversation" }]}
      />
      {state.status === "loading" ? (
        <Skeleton className="h-64 w-full" />
      ) : state.status === "error" ? (
        <ErrorState message={state.message} onRetry={fetchData} />
      ) : (
        <ul className="space-y-4">
          {groups.map((group, index) => (
            <li
              key={`${group.authorMemberId}-${index}`}
              className={`flex flex-col gap-1 ${group.mine ? "items-end" : "items-start"}`}
            >
              {!group.mine ? (
                <p className="px-1 text-xs font-medium text-text-muted">{group.authorName}</p>
              ) : null}
              {group.messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[70%] ${
                    group.mine ? "bg-surface-tint text-text" : "border border-border/60 bg-surface text-text"
                  }`}
                >
                  <p className="text-sm break-words whitespace-pre-wrap">{m.body}</p>
                  <p className={`mt-1 text-[11px] text-text-muted ${group.mine ? "text-right" : "text-left"}`}>
                    {formatTimestamp(m.created_at)}
                    {group.mine && m.read_by_member_ids.length > 1 ? " · Seen" : ""}
                  </p>
                </div>
              ))}
            </li>
          ))}
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
        <Button variant="primary" onClick={handleSend} disabled={body.trim().length === 0}>
          Send
        </Button>
      </div>
    </div>
  );
}
