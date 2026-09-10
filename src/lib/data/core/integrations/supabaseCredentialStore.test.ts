import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCredentialById, insertCredential, updateCredential } from "@/lib/data/core/integrations/supabaseCredentialStore";
import type { IntegrationCredential } from "@/core/integrations/types";

type QueryResult = { data: unknown; error: unknown };

/** Mirrors the established `createMockSupabase` helper (`lib/data/clientAccess/supabaseRepository.test.ts`), adapted for the async server-only client factory this store uses instead of the sync browser client. */
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
    b.is = chain("is");
    b.order = chain("order");
    b.limit = chain("limit");
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
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  vi.mocked(createClient).mockResolvedValue(client as never);
  return { calls };
}

function credentialRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "cred_1",
    workspace_id: "ws_1",
    member_id: null,
    connection_id: "conn_1",
    kind: "oauth_token",
    scopes: ["gmail.readonly"],
    expires_at: null,
    rotated_at: null,
    revoked_at: null,
    key_hash: null,
    key_prefix: null,
    access_token_ref: "vault_secret_abc",
    refresh_token_ref: null,
    created_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const CREDENTIAL: IntegrationCredential = {
  id: "cred_1",
  workspace_id: "ws_1",
  member_id: "user_2",
  connection_id: "conn_1",
  kind: "oauth_token",
  scopes: ["gmail.readonly"],
  expires_at: null,
  rotated_at: null,
  revoked_at: null,
  key_hash: null,
  key_prefix: null,
  access_token_ref: "vault_secret_abc",
  refresh_token_ref: null,
  created_by: "user_1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseCredentialStore", () => {
  it("insertCredential writes the row, including member_id, and never the plaintext — only the already-encrypted access_token_ref", async () => {
    const { calls } = mockSupabase([{ data: credentialRow({ member_id: "user_2" }), error: null }]);

    const result = await insertCredential(CREDENTIAL);

    const insertCall = calls.find((c) => c.table === "integration_credentials" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.member_id).toBe("user_2");
    expect(payload.access_token_ref).toBe("vault_secret_abc");
    expect(payload).not.toHaveProperty("plaintext");
    expect(result.member_id).toBe("user_2");
    expect(result.access_token_ref).toBe("vault_secret_abc");
  });

  it("getCredentialById maps every field, including a null member_id for a workspace-owned credential", async () => {
    mockSupabase([{ data: credentialRow(), error: null }]);

    const result = await getCredentialById("cred_1");

    expect(result?.member_id).toBeNull();
    expect(result?.kind).toBe("oauth_token");
    expect(result?.access_token_ref).toBe("vault_secret_abc");
  });

  it("getCredentialById returns null for a row that doesn't exist, never throwing", async () => {
    mockSupabase([{ data: null, error: null }]);

    const result = await getCredentialById("cred_missing");

    expect(result).toBeNull();
  });

  it("updateCredential only sends the changed fields, never overwriting access_token_ref with an unset value", async () => {
    const { calls } = mockSupabase([{ data: credentialRow({ revoked_at: "2026-02-01T00:00:00.000Z" }), error: null }]);

    await updateCredential("cred_1", { revoked_at: "2026-02-01T00:00:00.000Z" });

    const updateCall = calls.find((c) => c.table === "integration_credentials" && c.method === "update");
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload).toEqual({ revoked_at: "2026-02-01T00:00:00.000Z" });
  });
});
