import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getThreadByProviderId, insertThread, listThreadsForMailbox, updateThread } from "@/lib/data/core/integrations/gmail/supabaseThreadStore";
import type { GmailThread } from "@/core/integrations/gmail/types";

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

function threadRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "thread_1",
    workspace_id: "ws_1",
    member_id: "user_1",
    mailbox_id: "mailbox_1",
    provider_thread_id: "thread_abc123",
    subject: null,
    snippet: null,
    latest_message_at: null,
    message_count: 0,
    unread_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const THREAD: GmailThread = {
  id: "thread_1",
  workspace_id: "ws_1",
  member_id: "user_1",
  mailbox_id: "mailbox_1",
  provider_thread_id: "thread_abc123",
  subject: null,
  snippet: null,
  latest_message_at: null,
  message_count: 0,
  unread_count: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseThreadStore", () => {
  it("insertThread writes to gmail_threads with the provider-native thread id preserved separately", async () => {
    const { calls } = mockSupabase([{ data: threadRow(), error: null }]);
    const result = await insertThread(THREAD);
    expect(calls[0]).toMatchObject({ table: "gmail_threads", method: "insert" });
    expect(calls[0].args[0]).toMatchObject({ mailbox_id: "mailbox_1", provider_thread_id: "thread_abc123" });
    expect(result.id).not.toBe(result.provider_thread_id);
  });

  it("getThreadByProviderId reads by (mailbox_id, provider_thread_id)", async () => {
    const { calls } = mockSupabase([{ data: threadRow(), error: null }]);
    await getThreadByProviderId("mailbox_1", "thread_abc123");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "mailbox_id" && c.args[1] === "mailbox_1")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "provider_thread_id" && c.args[1] === "thread_abc123")).toBe(true);
  });

  it("listThreadsForMailbox scopes to the given mailbox", async () => {
    const { calls } = mockSupabase([{ data: [threadRow()], error: null }]);
    const rows = await listThreadsForMailbox("mailbox_1");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "mailbox_id" && c.args[1] === "mailbox_1")).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("updateThread only sends the changed fields", async () => {
    mockSupabase([{ data: threadRow({ message_count: 3 }), error: null }]);
    const result = await updateThread("thread_1", { message_count: 3 });
    expect(result?.message_count).toBe(3);
  });

  it("propagates a real Supabase/Postgres error rather than swallowing it", async () => {
    mockSupabase([{ data: null, error: { message: "connection refused", code: "08006" } }]);
    await expect(getThreadByProviderId("mailbox_1", "thread_abc123")).rejects.toThrow();
  });
});
