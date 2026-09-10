import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getMailboxByConnectionId, getMailboxById, insertMailbox, listMailboxesForWorkspace, updateMailbox } from "@/lib/data/core/integrations/gmail/supabaseMailboxStore";
import type { GmailMailbox } from "@/core/integrations/gmail/types";

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

function mailboxRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "mailbox_1",
    workspace_id: "ws_1",
    member_id: "user_1",
    integration_connection_id: "conn_1",
    provider_account_id: null,
    email_address: null,
    display_name: null,
    history_id: null,
    sync_status: "not_synced",
    last_synced_at: null,
    last_successful_sync_at: null,
    sync_error_code: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const MAILBOX: GmailMailbox = {
  id: "mailbox_1",
  workspace_id: "ws_1",
  member_id: "user_1",
  integration_connection_id: "conn_1",
  provider_account_id: null,
  email_address: null,
  display_name: null,
  history_id: null,
  sync_status: "not_synced",
  last_synced_at: null,
  last_successful_sync_at: null,
  sync_error_code: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseMailboxStore", () => {
  it("insertMailbox writes to gmail_mailboxes, including a required (never-null) member_id", async () => {
    const { calls } = mockSupabase([{ data: mailboxRow(), error: null }]);
    const result = await insertMailbox(MAILBOX);

    expect(calls[0]).toMatchObject({ table: "gmail_mailboxes", method: "insert" });
    expect(calls[0].args[0]).toMatchObject({ workspace_id: "ws_1", member_id: "user_1", integration_connection_id: "conn_1" });
    expect(result.member_id).toBe("user_1");
  });

  it("getMailboxByConnectionId reads by integration_connection_id and returns null for no match", async () => {
    const { calls } = mockSupabase([{ data: null, error: null }]);
    const result = await getMailboxByConnectionId("conn_missing");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "integration_connection_id")).toBe(true);
    expect(result).toBeNull();
  });

  it("getMailboxById returns null for a missing mailbox rather than throwing", async () => {
    mockSupabase([{ data: null, error: null }]);
    expect(await getMailboxById("mailbox_missing")).toBeNull();
  });

  it("listMailboxesForWorkspace scopes to the given workspace", async () => {
    const { calls } = mockSupabase([{ data: [mailboxRow()], error: null }]);
    const rows = await listMailboxesForWorkspace("ws_1");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "ws_1")).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("updateMailbox only sends the changed fields", async () => {
    const { calls } = mockSupabase([{ data: mailboxRow({ sync_status: "synced" }), error: null }]);
    await updateMailbox("mailbox_1", { sync_status: "synced" });
    const payload = calls[0].args[0] as Record<string, unknown>;
    expect(payload).toEqual({ sync_status: "synced" });
  });

  it("propagates a real Supabase/Postgres error rather than swallowing it", async () => {
    mockSupabase([{ data: null, error: { message: "connection refused", code: "08006" } }]);
    await expect(getMailboxById("mailbox_1")).rejects.toThrow();
  });
});
