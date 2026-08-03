/**
 * Checkpoint 14, Step 8 — a genuinely new, deliberately minimal messaging
 * domain. One `ClientPortalMessageThread` per Client Account per
 * Workspace (kept singular per this phase — a client has exactly one
 * conversation with the Workspace, not one per topic); `authorType`
 * distinguishes a client's own message from a staff reply, since both
 * read from the same thread. No realtime: a thread reloads only when the
 * Messages page is opened or explicitly refreshed — no websocket, no
 * polling loop, per this checkpoint's own non-goals.
 */
export const CLIENT_PORTAL_MESSAGE_AUTHOR_TYPES = ["client", "staff"] as const;
export type ClientPortalMessageAuthorType = (typeof CLIENT_PORTAL_MESSAGE_AUTHOR_TYPES)[number];

export interface ClientPortalMessage {
  id: string;
  thread_id: string;
  author_type: ClientPortalMessageAuthorType;
  /** The staff member's own display name for a `"staff"` message — never an internal member id a client shouldn't see; `null` for a `"client"` message (the Portal already knows it's "You"). */
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface ClientPortalMessageThread {
  id: string;
  workspace_id: string;
  client_account_id: string;
  subject: string;
  last_message_at: string;
  /** Unread from the *client's* own point of view — a staff message the client hasn't yet opened the thread to see. */
  unread_count: number;
}
