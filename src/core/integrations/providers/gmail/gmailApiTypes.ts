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
