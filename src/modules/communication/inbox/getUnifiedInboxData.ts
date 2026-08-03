"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { mockMessageThreadRepository } from "@/lib/data/core/communication/messageThreadStore";
import { listClientPortalThreadsForWorkspace } from "@/lib/data/clientPortal/clientPortalMessageStore";
import type { InboxItem } from "@/types/communication";

const GENERIC_ACCESS_ERROR = "The Unified Inbox isn't available. You may not have access to it.";

/**
 * v2.0 Checkpoint 24, Step 4 — the Unified Inbox. Merges two existing
 * write-side stores at the read layer only — Internal Messaging
 * (`messageThreadStore.ts`, new this checkpoint) and Client Portal
 * Messages (`clientPortalMessageStore.ts`, Checkpoint 14) — into one
 * normalized `InboxItem[]`. "Every future provider should feed this
 * inbox" (spec) means: a future Email/SMS adapter is a third source
 * merged the same way, never a rewrite of this function's shape.
 *
 * Known scope note: `ClientPortalMessageThread.unread_count` is tracked
 * from the *client's* own point of view only (Checkpoint 14 never built a
 * staff-side read-receipt for these threads) — so a Client Portal inbox
 * row's `unreadCount` here answers "has the client seen the latest
 * message," not "has staff." See `docs/inbox-engine.md`'s Known
 * Limitations.
 */
export async function getUnifiedInboxData(): Promise<{ success: true; data: InboxItem[] } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const internalThreads = await mockMessageThreadRepository.listThreadsForMember(session.workspace.id, session.membership.id);
  const internalItems: InboxItem[] = await Promise.all(
    internalThreads.map(async (thread) => {
      const messages = await mockMessageThreadRepository.listMessages(thread.id);
      const lastMessage = messages[messages.length - 1];
      const unreadCount = messages.filter((m) => !m.read_by_member_ids.includes(session.membership.id)).length;
      return {
        id: thread.id,
        source: "internal_message" as const,
        subject: thread.subject,
        previewBody: lastMessage?.body ?? "",
        participantLabel: thread.kind === "team" ? (thread.subject ?? "Team conversation") : "Direct message",
        unreadCount,
        pinned: thread.pinned_by_member_ids.includes(session.membership.id),
        archived: thread.archived_by_member_ids.includes(session.membership.id),
        lastMessageAt: thread.last_message_at,
        href: `/inbox/${thread.id}`,
      };
    }),
  );

  const clientPortalThreads = listClientPortalThreadsForWorkspace(session.workspace.id);
  const clientPortalItems: InboxItem[] = clientPortalThreads.map((thread) => ({
    id: thread.id,
    source: "client_portal_message" as const,
    subject: thread.subject,
    previewBody: "",
    participantLabel: `Client — ${thread.subject}`,
    unreadCount: thread.unread_count,
    pinned: false,
    archived: false,
    lastMessageAt: thread.last_message_at,
    href: `/client-portal/messages?thread=${thread.id}`,
  }));

  const merged = [...internalItems, ...clientPortalItems].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.lastMessageAt.localeCompare(a.lastMessageAt);
  });

  return { success: true, data: merged };
}
