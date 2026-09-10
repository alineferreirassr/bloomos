/**
 * GMAIL-05 — raw Gmail REST API response shapes (`users.getProfile`,
 * `users.threads.list`, `users.threads.get`). Deliberately a thin,
 * partial mirror of Google's own documented schema — only the fields
 * this codebase actually reads — not a full `googleapis` type import
 * (this codebase has no `googleapis` dependency; see `gmailProvider.ts`'s
 * own "plain fetch, no SDK" precedent).
 */

export interface GmailApiProfile {
  emailAddress: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId: string;
}

export interface GmailApiThreadListResponse {
  threads?: Array<{ id: string; snippet?: string; historyId?: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface GmailApiMessagePartHeader {
  name: string;
  value: string;
}

export interface GmailApiMessagePartBody {
  attachmentId?: string;
  size?: number;
  data?: string;
}

export interface GmailApiMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailApiMessagePartHeader[];
  body?: GmailApiMessagePartBody;
  parts?: GmailApiMessagePart[];
}

export interface GmailApiMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailApiMessagePart;
}

export interface GmailApiThread {
  id: string;
  historyId?: string;
  messages?: GmailApiMessage[];
}

/** GMAIL-06 — `users.history.list`'s own event shapes. Every history record references messages only by `{id, threadId}` — never a full payload; the full message is only ever obtained via `getThread`/`getMessage`, exactly like the rest of this file's own "thin mirror of what's actually read" convention. */
export interface GmailApiHistoryMessageRef {
  id: string;
  threadId: string;
}

export interface GmailApiHistoryRecord {
  id: string;
  messagesAdded?: Array<{ message: GmailApiHistoryMessageRef }>;
  messagesDeleted?: Array<{ message: GmailApiHistoryMessageRef }>;
  labelsAdded?: Array<{ message: GmailApiHistoryMessageRef; labelIds?: string[] }>;
  labelsRemoved?: Array<{ message: GmailApiHistoryMessageRef; labelIds?: string[] }>;
}

export interface GmailApiHistoryListResponse {
  history?: GmailApiHistoryRecord[];
  nextPageToken?: string;
  /** Only present on a response with no `nextPageToken` — the mailbox's current historyId, i.e. "you are now fully caught up as of this id." */
  historyId?: string;
}
