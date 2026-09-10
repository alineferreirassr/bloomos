import type { GmailApiMessage, GmailApiMessagePart, GmailApiMessagePartHeader } from "@/core/integrations/providers/gmail/gmailApiTypes";
import type { GmailEmailAddress } from "@/core/integrations/gmail/types";

/**
 * GMAIL-05 — maps one raw Gmail API message into the shape
 * `gmailMailboxManager.upsertMessage` expects. Gmail's own API already
 * parses the MIME tree into a `payload.parts` structure with `mimeType`/
 * `filename`/`body.data` resolved — this file only walks that
 * already-parsed tree (bounded, see `MAX_MIME_DEPTH`) to find the
 * text/plain and text/html bodies and detect attachment-shaped parts. It
 * never hand-parses raw RFC 2822 MIME boundaries itself.
 *
 * Never downloads attachment bytes (`body.attachmentId` is present but
 * never resolved via `users.messages.attachments.get`) and never renders
 * `body_html` — see `core/integrations/gmail/types.ts`'s own `body_html`
 * doc comment for the "must be sanitized before rendering" requirement a
 * future Inbox UI owns.
 */

export interface ParsedGmailMessage {
  providerMessageId: string;
  providerThreadId: string;
  internalDate: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  fromAddress: GmailEmailAddress | null;
  toAddresses: GmailEmailAddress[];
  ccAddresses: GmailEmailAddress[];
  bccAddresses: GmailEmailAddress[];
  replyToAddresses: GmailEmailAddress[];
  messageIdHeader: string | null;
  inReplyTo: string | null;
  referencesHeader: string | null;
  labelIds: string[];
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  isSent: boolean;
  hasAttachments: boolean;
}

/** Protects against a pathological/malicious part tree causing unbounded recursion — no real Gmail message nests this deep. */
const MAX_MIME_DEPTH = 10;

/** Gmail's own base64url encoding (RFC 4648 §5) — `-`/`_` instead of `+`/`/`, no padding. */
export function fromBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

function getHeader(headers: GmailApiMessagePartHeader[] | undefined, name: string): string | null {
  if (!headers) return null;
  const header = headers.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : null;
}

interface BodyAccumulator {
  text: string | null;
  html: string | null;
  hasAttachments: boolean;
}

function walkParts(part: GmailApiMessagePart | undefined, depth: number, acc: BodyAccumulator): void {
  if (!part || depth > MAX_MIME_DEPTH) return;

  if (part.body?.attachmentId) acc.hasAttachments = true;
  // A named part is an attachment (or an inline image with a filename) — never body content, and its own children (there normally are none) aren't walked.
  if (part.filename && part.filename.length > 0) {
    acc.hasAttachments = true;
    return;
  }

  if (part.mimeType === "text/plain" && part.body?.data && acc.text === null) {
    acc.text = fromBase64Url(part.body.data);
  } else if (part.mimeType === "text/html" && part.body?.data && acc.html === null) {
    acc.html = fromBase64Url(part.body.data);
  }

  if (part.parts) {
    for (const child of part.parts) walkParts(child, depth + 1, acc);
  }
}

/** Splits a header address list on commas that aren't inside a quoted display name — `"Doe, Jane" <jane@example.com>, john@example.com` must split into exactly 2 addresses, not 3. Bounded by the header's own length; not a general RFC 5322 parser. */
function splitAddressList(value: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of value) {
    if (char === '"') inQuotes = !inQuotes;
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

/** Parses `"Name" <email>` / `Name <email>` / bare `email` — the common shapes a real inbox actually contains. Not full RFC 5322 (comments, encoded-words, route addressing are out of scope for this foundation). */
export function parseAddressList(headerValue: string | null): GmailEmailAddress[] {
  if (!headerValue) return [];
  return splitAddressList(headerValue)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = part.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
      if (match) {
        const name = match[1].trim();
        return { name: name.length > 0 ? name : null, email: match[2].trim() };
      }
      return { name: null, email: part };
    });
}

export function parseGmailMessage(raw: GmailApiMessage): ParsedGmailMessage {
  const headers = raw.payload?.headers;
  const labelIds = raw.labelIds ?? [];
  const body: BodyAccumulator = { text: null, html: null, hasAttachments: false };
  walkParts(raw.payload, 0, body);

  const internalDateMs = raw.internalDate ? Number(raw.internalDate) : NaN;

  return {
    providerMessageId: raw.id,
    providerThreadId: raw.threadId,
    internalDate: Number.isFinite(internalDateMs) ? new Date(internalDateMs).toISOString() : null,
    subject: getHeader(headers, "Subject"),
    snippet: raw.snippet ?? null,
    bodyText: body.text,
    bodyHtml: body.html,
    fromAddress: parseAddressList(getHeader(headers, "From"))[0] ?? null,
    toAddresses: parseAddressList(getHeader(headers, "To")),
    ccAddresses: parseAddressList(getHeader(headers, "Cc")),
    bccAddresses: parseAddressList(getHeader(headers, "Bcc")),
    replyToAddresses: parseAddressList(getHeader(headers, "Reply-To")),
    messageIdHeader: getHeader(headers, "Message-ID"),
    inReplyTo: getHeader(headers, "In-Reply-To"),
    referencesHeader: getHeader(headers, "References"),
    labelIds,
    isRead: !labelIds.includes("UNREAD"),
    isStarred: labelIds.includes("STARRED"),
    isDraft: labelIds.includes("DRAFT"),
    isSent: labelIds.includes("SENT"),
    hasAttachments: body.hasAttachments,
  };
}
