import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import {
  deletePendingAuthorization,
  getPendingAuthorizationByState,
  insertPendingAuthorization,
  listPendingAuthorizationsForWorkspace,
} from "@/lib/data/core/integrations/supabasePendingOAuthAuthorizationStore";
import type { PendingOAuthAuthorizationRow } from "@/lib/data/core/integrations/pendingOAuthAuthorizationStore";

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
    b.insert = chain("insert");
    b.delete = chain("delete");
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

function pendingRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    state: "state_1",
    workspace_id: "ws_1",
    member_id: null,
    provider_id: "gmail",
    connection_id: "conn_1",
    redirect_uri: "https://app.test/callback",
    code_verifier_ref: "secretref_1",
    created_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2026-01-01T00:10:00.000Z",
    ...overrides,
  };
}

const ROW: PendingOAuthAuthorizationRow = {
  state: "state_1",
  workspace_id: "ws_1",
  member_id: "user_2",
  provider_id: "gmail",
  connection_id: "conn_1",
  redirect_uri: "https://app.test/callback",
  code_verifier_ref: "secretref_1",
  created_at: "2026-01-01T00:00:00.000Z",
  expires_at: "2026-01-01T00:10:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabasePendingOAuthAuthorizationStore", () => {
  it("insertPendingAuthorization writes to oauth_pending_authorizations, including a member-owned member_id", async () => {
    const { calls } = mockSupabase([{ data: pendingRow({ member_id: "user_2" }), error: null }]);

    const result = await insertPendingAuthorization(ROW);

    expect(calls[0]).toMatchObject({ table: "oauth_pending_authorizations", method: "insert" });
    expect(calls[0].args[0]).toMatchObject({ state: "state_1", workspace_id: "ws_1", member_id: "user_2", code_verifier_ref: "secretref_1" });
    expect(result.member_id).toBe("user_2");
  });

  it("getPendingAuthorizationByState reads by state and returns null for no match", async () => {
    mockSupabase([{ data: null, error: null }]);

    const result = await getPendingAuthorizationByState("missing_state");

    expect(result).toBeNull();
  });

  it("getPendingAuthorizationByState maps the row's own code_verifier_ref — an opaque Vault id, never the plaintext PKCE verifier it stands in for", async () => {
    mockSupabase([{ data: pendingRow(), error: null }]);

    const result = await getPendingAuthorizationByState("state_1");

    expect(result?.code_verifier_ref).toBe("secretref_1");
    expect(result?.provider_id).toBe("gmail");
    expect(result?.workspace_id).toBe("ws_1");
  });

  it("deletePendingAuthorization deletes by state and reports whether a row existed", async () => {
    mockSupabase([{ data: [{ state: "state_1" }], error: null }]);

    const removed = await deletePendingAuthorization("state_1");

    expect(removed).toBe(true);
  });

  it("deletePendingAuthorization returns false when nothing was deleted", async () => {
    mockSupabase([{ data: [], error: null }]);

    const removed = await deletePendingAuthorization("missing_state");

    expect(removed).toBe(false);
  });

  it("listPendingAuthorizationsForWorkspace scopes to the given workspace", async () => {
    const { calls } = mockSupabase([{ data: [pendingRow()], error: null }]);

    const rows = await listPendingAuthorizationsForWorkspace("ws_1");

    expect(calls.some((c) => c.method === "eq" && c.args[0] === "workspace_id" && c.args[1] === "ws_1")).toBe(true);
    expect(rows).toHaveLength(1);
  });

  it("propagates a real Supabase/Postgres error rather than swallowing it", async () => {
    mockSupabase([{ data: null, error: { message: "connection refused", code: "08006" } }]);

    await expect(getPendingAuthorizationByState("state_1")).rejects.toThrow();
  });
});
