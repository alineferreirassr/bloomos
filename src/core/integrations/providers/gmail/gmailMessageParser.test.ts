import { describe, expect, it } from "vitest";
import { fromBase64Url, parseAddressList, parseGmailMessage } from "@/core/integrations/providers/gmail/gmailMessageParser";
import type { GmailApiMessage } from "@/core/integrations/providers/gmail/gmailApiTypes";

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function header(name: string, value: string) {
  return { name, value };
}

describe("fromBase64Url", () => {
  it("decodes Gmail's own base64url encoding (- and _ instead of +/, no padding)", () => {
    const original = "Hi Ana, following up on the booking — see you Friday!";
    expect(fromBase64Url(toBase64Url(original))).toBe(original);
  });

  it("handles inputs that need padding restored", () => {
    // "a" -> base64 "YQ==" -> base64url "YQ" (2 chars, needs 2 '=' restored)
    expect(fromBase64Url("YQ")).toBe("a");
  });
});

describe("parseAddressList", () => {
  it("parses a bare email address", () => {
    expect(parseAddressList("jordan@example.com")).toEqual([{ name: null, email: "jordan@example.com" }]);
  });

  it("parses 'Name <email>' shape", () => {
    expect(parseAddressList("Jordan Lee <jordan@example.com>")).toEqual([{ name: "Jordan Lee", email: "jordan@example.com" }]);
  });

  it("parses '\"Quoted Name\" <email>' shape", () => {
    expect(parseAddressList('"Jordan Lee" <jordan@example.com>')).toEqual([{ name: "Jordan Lee", email: "jordan@example.com" }]);
  });

  it("splits a comma-separated list without splitting inside a quoted display name containing a comma", () => {
    const result = parseAddressList('"Doe, Jane" <jane@example.com>, john@example.com');
    expect(result).toEqual([
      { name: "Doe, Jane", email: "jane@example.com" },
      { name: null, email: "john@example.com" },
    ]);
  });

  it("returns an empty array for a null/absent header", () => {
    expect(parseAddressList(null)).toEqual([]);
  });
});

describe("parseGmailMessage", () => {
  const baseMessage: GmailApiMessage = {
    id: "msg_xyz789",
    threadId: "thread_abc123",
    labelIds: ["INBOX"],
    snippet: "Hi Ana, following up on the booking",
    internalDate: "1735689600000", // 2025-01-01T00:00:00.000Z
    payload: {
      mimeType: "text/plain",
      headers: [
        header("Subject", "Re: Booking confirmation"),
        header("From", "Jordan Lee <jordan@example.com>"),
        header("To", "ana@amorebloom.com"),
        header("Message-ID", "<abc123@mail.gmail.com>"),
      ],
      body: { data: toBase64Url("Hi Ana, following up on the booking.") },
    },
  };

  it("preserves provider-native ids separately from anything internal", () => {
    const parsed = parseGmailMessage(baseMessage);
    expect(parsed.providerMessageId).toBe("msg_xyz789");
    expect(parsed.providerThreadId).toBe("thread_abc123");
  });

  it("converts internalDate (epoch ms as a string) to an ISO timestamp", () => {
    const parsed = parseGmailMessage(baseMessage);
    expect(parsed.internalDate).toBe(new Date(1735689600000).toISOString());
  });

  it("returns null internalDate for a missing/malformed value rather than throwing", () => {
    expect(parseGmailMessage({ ...baseMessage, internalDate: undefined }).internalDate).toBeNull();
    expect(parseGmailMessage({ ...baseMessage, internalDate: "not-a-number" }).internalDate).toBeNull();
  });

  it("extracts a plain-text top-level body", () => {
    const parsed = parseGmailMessage(baseMessage);
    expect(parsed.bodyText).toBe("Hi Ana, following up on the booking.");
    expect(parsed.bodyHtml).toBeNull();
  });

  it("extracts an HTML top-level body", () => {
    const message: GmailApiMessage = {
      ...baseMessage,
      payload: { mimeType: "text/html", headers: baseMessage.payload!.headers, body: { data: toBase64Url("<p>Hi Ana</p>") } },
    };
    expect(parseGmailMessage(message).bodyHtml).toBe("<p>Hi Ana</p>");
  });

  it("extracts both plain-text and HTML bodies from a nested multipart/alternative structure", () => {
    const message: GmailApiMessage = {
      ...baseMessage,
      payload: {
        mimeType: "multipart/mixed",
        headers: baseMessage.payload!.headers,
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", body: { data: toBase64Url("Plain version") } },
              { mimeType: "text/html", body: { data: toBase64Url("<p>HTML version</p>") } },
            ],
          },
        ],
      },
    };
    const parsed = parseGmailMessage(message);
    expect(parsed.bodyText).toBe("Plain version");
    expect(parsed.bodyHtml).toBe("<p>HTML version</p>");
  });

  it("detects an attachment part (filename present) without treating its content as a body", () => {
    const message: GmailApiMessage = {
      ...baseMessage,
      payload: {
        mimeType: "multipart/mixed",
        headers: baseMessage.payload!.headers,
        parts: [
          { mimeType: "text/plain", body: { data: toBase64Url("See attached.") } },
          { mimeType: "application/pdf", filename: "contract.pdf", body: { attachmentId: "att_1", size: 1024 } },
        ],
      },
    };
    const parsed = parseGmailMessage(message);
    expect(parsed.hasAttachments).toBe(true);
    expect(parsed.bodyText).toBe("See attached.");
  });

  it("detects an attachment via body.attachmentId even without a filename", () => {
    const message: GmailApiMessage = {
      ...baseMessage,
      payload: { mimeType: "multipart/mixed", headers: baseMessage.payload!.headers, parts: [{ mimeType: "image/png", body: { attachmentId: "att_2" } }] },
    };
    expect(parseGmailMessage(message).hasAttachments).toBe(true);
  });

  it("never has attachments for a plain message with no parts", () => {
    expect(parseGmailMessage(baseMessage).hasAttachments).toBe(false);
  });

  it("stops walking at a bounded depth rather than recursing without limit", () => {
    let deepest: { mimeType: string; parts?: unknown[] } = { mimeType: "text/plain", parts: undefined };
    for (let i = 0; i < 50; i++) {
      deepest = { mimeType: "multipart/mixed", parts: [deepest] };
    }
    const message: GmailApiMessage = { ...baseMessage, payload: { mimeType: "multipart/mixed", headers: baseMessage.payload!.headers, parts: [deepest as never] } };
    expect(() => parseGmailMessage(message)).not.toThrow();
  });

  it("parses To/Cc/Bcc/Reply-To/Message-ID/In-Reply-To/References headers", () => {
    const message: GmailApiMessage = {
      ...baseMessage,
      payload: {
        ...baseMessage.payload!,
        headers: [
          ...baseMessage.payload!.headers!,
          header("Cc", "manager@amorebloom.com"),
          header("Bcc", "audit@amorebloom.com"),
          header("Reply-To", "no-reply@example.com"),
          header("In-Reply-To", "<original@mail.gmail.com>"),
          header("References", "<original@mail.gmail.com> <second@mail.gmail.com>"),
        ],
      },
    };
    const parsed = parseGmailMessage(message);
    expect(parsed.subject).toBe("Re: Booking confirmation");
    expect(parsed.fromAddress).toEqual({ name: "Jordan Lee", email: "jordan@example.com" });
    expect(parsed.toAddresses).toEqual([{ name: null, email: "ana@amorebloom.com" }]);
    expect(parsed.ccAddresses).toEqual([{ name: null, email: "manager@amorebloom.com" }]);
    expect(parsed.bccAddresses).toEqual([{ name: null, email: "audit@amorebloom.com" }]);
    expect(parsed.replyToAddresses).toEqual([{ name: null, email: "no-reply@example.com" }]);
    expect(parsed.messageIdHeader).toBe("<abc123@mail.gmail.com>");
    expect(parsed.inReplyTo).toBe("<original@mail.gmail.com>");
    expect(parsed.referencesHeader).toBe("<original@mail.gmail.com> <second@mail.gmail.com>");
  });

  it("preserves label ids as a plain array", () => {
    const message: GmailApiMessage = { ...baseMessage, labelIds: ["INBOX", "IMPORTANT", "CATEGORY_PERSONAL"] };
    expect(parseGmailMessage(message).labelIds).toEqual(["INBOX", "IMPORTANT", "CATEGORY_PERSONAL"]);
  });

  it("derives is_read from the absence of the UNREAD label", () => {
    expect(parseGmailMessage({ ...baseMessage, labelIds: ["INBOX", "UNREAD"] }).isRead).toBe(false);
    expect(parseGmailMessage({ ...baseMessage, labelIds: ["INBOX"] }).isRead).toBe(true);
  });

  it("derives is_starred from the STARRED label", () => {
    expect(parseGmailMessage({ ...baseMessage, labelIds: ["INBOX", "STARRED"] }).isStarred).toBe(true);
    expect(parseGmailMessage({ ...baseMessage, labelIds: ["INBOX"] }).isStarred).toBe(false);
  });

  it("derives is_draft from the DRAFT label", () => {
    expect(parseGmailMessage({ ...baseMessage, labelIds: ["DRAFT"] }).isDraft).toBe(true);
    expect(parseGmailMessage({ ...baseMessage, labelIds: ["INBOX"] }).isDraft).toBe(false);
  });

  it("derives is_sent from the SENT label", () => {
    expect(parseGmailMessage({ ...baseMessage, labelIds: ["SENT"] }).isSent).toBe(true);
    expect(parseGmailMessage({ ...baseMessage, labelIds: ["INBOX"] }).isSent).toBe(false);
  });

  it("falls back to snippet=null and subject/from=null when headers/snippet are absent, rather than throwing", () => {
    const message: GmailApiMessage = { id: "msg_1", threadId: "thread_1", labelIds: [] };
    const parsed = parseGmailMessage(message);
    expect(parsed.subject).toBeNull();
    expect(parsed.snippet).toBeNull();
    expect(parsed.fromAddress).toBeNull();
    expect(parsed.bodyText).toBeNull();
    expect(parsed.hasAttachments).toBe(false);
  });
});
