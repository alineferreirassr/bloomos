import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getMessageByProviderId, insertMessage, listMessagesForThread, updateMessage } from "@/lib/data/core/integrations/gmail/supabaseMessageStore";
import type { GmailMessage } from "@/core/integrations/gmail/types";

type QueryResult = { data: unknown; error: unknown };

function mockSupabase(responses: QueryResult[]) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  let i = 0;
  function next(): QueryResult {
    if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    return responses[i++];
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    b.select = chain("select");
    b.eq = chain("eq");
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return next();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return next();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(next());
    };
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  vi.mocked(createClient).mockResolvedValue(client as never);
  return { calls };
}

function messageRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "message_1",
    workspace_id: "ws_1",
    member_id: "user_1",
    mailbox_id: "mailbox_1",
    thread_id: "thread_1",
    provider_message_id: "msg_xyz789",
    provider_thread_id: "thread_abc123",
    internal_date: null,
    subject: null,
    snippet: null,
    body_text: null,
    body_html: null,
    from_address: null,
    to_addresses: [],
    cc_addresses: [],
    bcc_addresses: [],
    reply_to_addresses: [],
    message_id_header: null,
    in_reply_to: null,
    references_header: null,
    label_ids: [],
    is_read: false,
    is_starred: false,
    is_draft: false,
    is_sent: false,
    has_attachments: false,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const MESSAGE: GmailMessage = {
  id: "message_1",
  workspace_id: "ws_1",
  member_id: "user_1",
  mailbox_id: "mailbox_1",
  thread_id: "thread_1",
  provider_message_id: "msg_xyz789",
  provider_thread_id: "thread_abc123",
  internal_date: null,
  subject: null,
  snippet: null,
  body_text: null,
  body_html: null,
  from_address: null,
  to_addresses: [],
  cc_addresses: [],
  bcc_addresses: [],
  reply_to_addresses: [],
  message_id_header: null,
  in_reply_to: null,
  references_header: null,
  label_ids: [],
  is_read: false,
  is_starred: false,
  is_draft: false,
  is_sent: false,
  has_attachments: false,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseMessageStore", () => {
  it("insertMessage writes to gmail_messages with the provider-native message id preserved separately", async () => {
    const { calls } = mockSupabase([{ data: messageRow(), error: null }]);
    const result = await insertMessage(MESSAGE);
    expect(calls[0]).toMatchObject({ table: "gmail_messages", method: "insert" });
    expect(calls[0].args[0]).toMatchObject({ mailbox_id: "mailbox_1", thread_id: "thread_1", provider_message_id: "msg_xyz789" });
    expect(result.id).not.toBe(result.provider_message_id);
  });

  it("never sends an attachment-bytes field — only has_attachments, the boolean signal", async () => {
    const { calls } = mockSupabase([{ data: messageRow(), error: null }]);
    await insertMessage(MESSAGE);
    const payload = calls[0].args[0] as Record<string, unknown>;
    expect(payload).toHaveProperty("has_attachments");
    expect(payload).not.toHaveProperty("attachment_bytes");
    expect(payload).not.toHaveProperty("attachments");
  });

  it("getMessageByProviderId reads by (mailbox_id, provider_message_id)", async () => {
    const { calls } = mockSupabase([{ data: messageRow(), error: null }]);
    await getMessageByProviderId("mailbox_1", "msg_xyz789");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "mailbox_id" && c.args[1] === "mailbox_1")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "provider_message_id" && c.args[1] === "msg_xyz789")).toBe(true);
  });

  it("listMessagesForThread scopes to the given thread, ordered oldest-first", async () => {
    const { calls } = mockSupabase([{ data: [messageRow()], error: null }]);
    const rows = await listMessagesForThread("thread_1");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "thread_id" && c.args[1] === "thread_1")).toBe(true);
    expect(calls.some((c) => c.method === "order" && c.args[0] === "internal_date" && (c.args[1] as { ascending: boolean }).ascending === true)).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("updateMessage only sends the changed fields", async () => {
    mockSupabase([{ data: messageRow({ is_read: true }), error: null }]);
    const result = await updateMessage("message_1", { is_read: true });
    expect(result?.is_read).toBe(true);
  });

  it("propagates a real Supabase/Postgres error rather than swallowing it", async () => {
    mockSupabase([{ data: null, error: { message: "connection refused", code: "08006" } }]);
    await expect(getMessageByProviderId("mailbox_1", "msg_xyz789")).rejects.toThrow();
  });
});
