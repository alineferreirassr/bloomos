import type { ClientPortalMessage, ClientPortalMessageThread } from "@/types/clientPortalMessage";
import { generateId, nowIso } from "@/lib/data/utils";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { MOCK_CURRENT_CLIENT_ACCOUNT_ID } from "@/lib/data/mock/clientAccountsStore";

/**
 * Checkpoint 14, Step 8 — Messages. Mock-only, unconditionally, regardless
 * of `NEXT_PUBLIC_DATA_MODE` — the same "new checkpoint domain, mock-only
 * this phase" precedent every other brand-new Portal concept this
 * checkpoint adds already follows (see `clientDocumentApprovalStore.ts`'s
 * own doc comment). A real `client_portal_message_threads` +
 * `client_portal_messages` schema is written as a migration
 * (`supabase/migrations/`) for a future checkpoint to actually apply — no
 * realtime publication is added there either, matching this checkpoint's
 * own non-goal.
 */
interface StoredThread extends ClientPortalMessageThread {
  workspace_id: string;
}

let threads: StoredThread[] = [];
let messages: ClientPortalMessage[] = [];

export function resetClientPortalMessageStore(): void {
  threads = [];
  messages = [];
  seedDemoThread();
}

function getOrCreateThread(workspaceId: string, clientAccountId: string): StoredThread {
  const existing = threads.find((thread) => thread.workspace_id === workspaceId && thread.client_account_id === clientAccountId);
  if (existing) return existing;
  const created: StoredThread = { id: generateId("message-thread"), workspace_id: workspaceId, client_account_id: clientAccountId, subject: "Messages", last_message_at: nowIso(), unread_count: 0 };
  threads = [...threads, created];
  return created;
}

export function getClientPortalMessageThread(workspaceId: string, clientAccountId: string): ClientPortalMessageThread {
  const thread = getOrCreateThread(workspaceId, clientAccountId);
  const unread = messages.filter((message) => message.thread_id === thread.id && message.author_type === "staff").length > 0 ? thread.unread_count : 0;
  return { ...thread, unread_count: unread };
}

/** Checkpoint 16, Step 9 — every message thread in one Workspace, across every Client Portal account. No workspace-wide list existed before this checkpoint — every prior caller already knew its own `clientAccountId` (a signed-in client only ever has one). */
export function listClientPortalThreadsForWorkspace(workspaceId: string): ClientPortalMessageThread[] {
  return threads
    .filter((thread) => thread.workspace_id === workspaceId)
    .map((thread) => getClientPortalMessageThread(thread.workspace_id, thread.client_account_id))
    .sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
}

export function listClientPortalMessages(threadId: string): ClientPortalMessage[] {
  return messages.filter((message) => message.thread_id === threadId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function sendClientPortalMessage(threadId: string, authorType: "client" | "staff", authorName: string | null, body: string): ClientPortalMessage {
  const message: ClientPortalMessage = { id: generateId("message"), thread_id: threadId, author_type: authorType, author_name: authorName, body, created_at: nowIso() };
  messages = [...messages, message];
  threads = threads.map((thread) => (thread.id === threadId ? { ...thread, last_message_at: message.created_at, unread_count: authorType === "staff" ? thread.unread_count + 1 : thread.unread_count } : thread));
  return message;
}

export function markClientPortalThreadRead(threadId: string): void {
  threads = threads.map((thread) => (thread.id === threadId ? { ...thread, unread_count: 0 } : thread));
}

/** A real, working demo conversation — never an empty inert placeholder — so the Client Portal's own live browser verification has something genuine to show. */
function seedDemoThread(): void {
  const thread = getOrCreateThread(CURRENT_WORKSPACE_ID, MOCK_CURRENT_CLIENT_ACCOUNT_ID);
  sendClientPortalMessage(thread.id, "staff", "Amoré Bloom Team", "Hi Naomi! We've started prepping your event details — let us know if you have any questions.");
  sendClientPortalMessage(thread.id, "client", null, "Thank you! Could you confirm the final guest count deadline?");
  sendClientPortalMessage(thread.id, "staff", "Amoré Bloom Team", "Of course — we'll need the final headcount two weeks before your event date.");
  markClientPortalThreadRead(thread.id);
}

seedDemoThread();
