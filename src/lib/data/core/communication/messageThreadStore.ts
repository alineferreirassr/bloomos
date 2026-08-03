import type { InternalMessageThread, InternalMessage, MessageThreadKind, InternalMessageAttachment } from "@/types/communication";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 24, Step 12 — Internal Messaging's own persistence.
 * Deliberately separate from `clientPortalMessageStore.ts` (Checkpoint 14):
 * that store's `ClientPortalMessageThread` is one-thread-per-client-account
 * by design and has no concept of a member-to-member or multi-member
 * thread. The Unified Inbox (Step 4) merges rows from both stores at the
 * read layer only — see `modules/communication/inbox/getUnifiedInboxData.ts`
 * — rather than forcing one store to serve two different invariants.
 */
let threads: InternalMessageThread[] = [];
let messages: InternalMessage[] = [];

/** Test-only: restore both stores to empty between test cases. */
export function resetMessageThreadStore(): void {
  threads = [];
  messages = [];
}

async function listThreadsForMember(workspaceId: string, memberId: string): Promise<InternalMessageThread[]> {
  await delay(100);
  return threads
    .filter((t) => t.workspace_id === workspaceId && t.participant_member_ids.includes(memberId))
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
}

async function getThread(threadId: string): Promise<InternalMessageThread | null> {
  await delay(50);
  return threads.find((t) => t.id === threadId) ?? null;
}

async function listMessages(threadId: string): Promise<InternalMessage[]> {
  await delay(100);
  return messages.filter((m) => m.thread_id === threadId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** A direct thread between the same two members is reused rather than duplicated — mirrors `getClientPortalMessageThread`'s own "exactly one thread" precedent, just scoped to a pair instead of a client account. */
async function findOrCreateDirectThread(workspaceId: string, memberIdA: string, memberIdB: string): Promise<InternalMessageThread> {
  const participantSet = new Set([memberIdA, memberIdB]);
  const existing = threads.find(
    (t) => t.workspace_id === workspaceId && t.kind === "direct" && t.participant_member_ids.length === participantSet.size && t.participant_member_ids.every((id) => participantSet.has(id)),
  );
  if (existing) return existing;

  const thread: InternalMessageThread = {
    id: generateId("thread"),
    workspace_id: workspaceId,
    kind: "direct",
    subject: null,
    participant_member_ids: Array.from(participantSet),
    created_by_member_id: memberIdA,
    pinned_by_member_ids: [],
    archived_by_member_ids: [],
    last_message_at: nowIso(),
    created_at: nowIso(),
  };
  threads = [...threads, thread];
  return thread;
}

async function createTeamThread(workspaceId: string, createdByMemberId: string, participantMemberIds: string[], subject: string): Promise<DataResult<InternalMessageThread>> {
  if (subject.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { subject: "Subject is required" });
  }
  const thread: InternalMessageThread = {
    id: generateId("thread"),
    workspace_id: workspaceId,
    kind: "team",
    subject: subject.trim(),
    participant_member_ids: Array.from(new Set([createdByMemberId, ...participantMemberIds])),
    created_by_member_id: createdByMemberId,
    pinned_by_member_ids: [],
    archived_by_member_ids: [],
    last_message_at: nowIso(),
    created_at: nowIso(),
  };
  threads = [...threads, thread];
  return ok(thread);
}

async function sendMessage(threadId: string, authorMemberId: string, authorName: string, body: string, mentionedMemberIds: string[] = [], attachments: InternalMessageAttachment[] = []): Promise<DataResult<InternalMessage>> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return fail("Please fix the highlighted fields.", { body: "Message cannot be empty" });
  }
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return fail("Conversation not found.");

  const message: InternalMessage = {
    id: generateId("message"),
    thread_id: threadId,
    author_member_id: authorMemberId,
    author_name: authorName,
    body: trimmed,
    mentioned_member_ids: mentionedMemberIds,
    attachments,
    read_by_member_ids: [authorMemberId],
    created_at: nowIso(),
  };
  messages = [...messages, message];
  threads = threads.map((t) => (t.id === threadId ? { ...t, last_message_at: message.created_at } : t));
  return ok(message);
}

async function markThreadRead(threadId: string, memberId: string): Promise<DataResult<number>> {
  let count = 0;
  messages = messages.map((m) => {
    if (m.thread_id === threadId && !m.read_by_member_ids.includes(memberId)) {
      count += 1;
      return { ...m, read_by_member_ids: [...m.read_by_member_ids, memberId] };
    }
    return m;
  });
  return ok(count);
}

async function setThreadPinned(threadId: string, memberId: string, pinned: boolean): Promise<DataResult<InternalMessageThread>> {
  const existing = threads.find((t) => t.id === threadId);
  if (!existing) return fail("Conversation not found.");
  const updated: InternalMessageThread = {
    ...existing,
    pinned_by_member_ids: pinned ? Array.from(new Set([...existing.pinned_by_member_ids, memberId])) : existing.pinned_by_member_ids.filter((id) => id !== memberId),
  };
  threads = threads.map((t) => (t.id === threadId ? updated : t));
  return ok(updated);
}

async function setThreadArchived(threadId: string, memberId: string, archived: boolean): Promise<DataResult<InternalMessageThread>> {
  const existing = threads.find((t) => t.id === threadId);
  if (!existing) return fail("Conversation not found.");
  const updated: InternalMessageThread = {
    ...existing,
    archived_by_member_ids: archived ? Array.from(new Set([...existing.archived_by_member_ids, memberId])) : existing.archived_by_member_ids.filter((id) => id !== memberId),
  };
  threads = threads.map((t) => (t.id === threadId ? updated : t));
  return ok(updated);
}

export type { MessageThreadKind };

export const mockMessageThreadRepository = {
  listThreadsForMember,
  getThread,
  listMessages,
  findOrCreateDirectThread,
  createTeamThread,
  sendMessage,
  markThreadRead,
  setThreadPinned,
  setThreadArchived,
};
