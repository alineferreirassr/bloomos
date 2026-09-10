/**
 * GMAIL-04 — Mailbox/Thread/Message Persistence Foundation. Schema and
 * type layer only: nothing here calls the Gmail API, syncs anything, or
 * renders anything. See the migration's own header comment
 * (`20260905100000_gmail_mailbox_persistence_foundation.sql`) for the
 * ownership model and the reasoning behind every deferred piece
 * (attachments, labels, account identity).
 *
 * Provider-native ids (`provider_account_id`, `provider_thread_id`,
 * `provider_message_id`) are always kept separate from this codebase's
 * own internal `id` (uuid) — never conflated, never used interchangeably.
 */

export type GmailSyncStatus = "not_synced" | "syncing" | "synced" | "error";

export interface GmailEmailAddress {
  name: string | null;
  email: string;
}

export interface GmailMailbox {
  id: string;
  workspace_id: string;
  member_id: string;
  integration_connection_id: string;
  provider_account_id: string | null;
  /** Never populated by GMAIL-03/GMAIL-04 — no identity scope (openid/email/profile) has been requested. Null until a future checkpoint adds one; never fabricated. */
  email_address: string | null;
  display_name: string | null;
  /** Gmail's own `users.history.list` cursor (`startHistoryId`) — opaque text, not a number BloomOS should ever compute. */
  history_id: string | null;
  sync_status: GmailSyncStatus;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  /** A short, non-sensitive, machine-readable code (e.g. "token_revoked") — never a raw provider error body. */
  sync_error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertGmailMailboxParams {
  workspaceId: string;
  memberId: string;
  integrationConnectionId: string;
  providerAccountId?: string | null;
  emailAddress?: string | null;
  displayName?: string | null;
  historyId?: string | null;
  syncStatus?: GmailSyncStatus;
  lastSyncedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  syncErrorCode?: string | null;
}

export interface GmailThread {
  id: string;
  workspace_id: string;
  member_id: string;
  mailbox_id: string;
  provider_thread_id: string;
  subject: string | null;
  snippet: string | null;
  latest_message_at: string | null;
  message_count: number;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface UpsertGmailThreadParams {
  workspaceId: string;
  memberId: string;
  mailboxId: string;
  providerThreadId: string;
  subject?: string | null;
  snippet?: string | null;
  latestMessageAt?: string | null;
  messageCount?: number;
  unreadCount?: number;
}

export interface GmailMessage {
  id: string;
  workspace_id: string;
  member_id: string;
  mailbox_id: string;
  thread_id: string;
  provider_message_id: string;
  provider_thread_id: string;
  internal_date: string | null;
  subject: string | null;
  snippet: string | null;
  body_text: string | null;
  /** MUST be sanitized before ever being rendered — no renderer exists yet (no Inbox UI is in scope through GMAIL-04). */
  body_html: string | null;
  from_address: GmailEmailAddress | null;
  to_addresses: GmailEmailAddress[];
  cc_addresses: GmailEmailAddress[];
  bcc_addresses: GmailEmailAddress[];
  reply_to_addresses: GmailEmailAddress[];
  message_id_header: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  /** Provider label ids only (e.g. "INBOX", "UNREAD") — no normalized label table, no label mutation this checkpoint. */
  label_ids: string[];
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  is_sent: boolean;
  /** The only attachment signal persisted this checkpoint — no bytes, no metadata rows. */
  has_attachments: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertGmailMessageParams {
  workspaceId: string;
  memberId: string;
  mailboxId: string;
  threadId: string;
  providerMessageId: string;
  providerThreadId: string;
  internalDate?: string | null;
  subject?: string | null;
  snippet?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  fromAddress?: GmailEmailAddress | null;
  toAddresses?: GmailEmailAddress[];
  ccAddresses?: GmailEmailAddress[];
  bccAddresses?: GmailEmailAddress[];
  replyToAddresses?: GmailEmailAddress[];
  messageIdHeader?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  labelIds?: string[];
  isRead?: boolean;
  isStarred?: boolean;
  isDraft?: boolean;
  isSent?: boolean;
  hasAttachments?: boolean;
}
