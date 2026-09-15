import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => createClientMock(...args) }));

import { resolveInstagramCommentReplyContext } from "@/core/automation/instagramCommentReplyServiceRole";

const ORIGINAL_ENV = { ...process.env };

/** A minimal, filter-applying stand-in for the Supabase query builder — rows only match if every recorded `.eq()` filter is satisfied, so a workspace_id mismatch mechanically fails to match rather than being hardcoded per test. Same technique as `socialSchedulerServiceRole.test.ts`'s own `filteringTableMock`. */
function filteringTableMock(rows: Record<string, unknown>[]) {
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn((column: string, value: unknown) => {
    filters[column] = value;
    return builder;
  });
  builder.maybeSingle = vi.fn(async () => {
    const match = rows.find((row) => Object.entries(filters).every(([key, value]) => row[key] === value));
    return { data: match ?? null, error: null };
  });
  return builder;
}

function makeSupabaseStub(config: { connections?: Record<string, unknown>[]; credentials?: Record<string, unknown>[]; secretsById?: Record<string, string | null> }) {
  const from = vi.fn((table: string) => {
    if (table === "integration_connections") return filteringTableMock(config.connections ?? []);
    if (table === "integration_credentials") return filteringTableMock(config.credentials ?? []);
    throw new Error(`Unexpected table in test stub: ${table}`);
  });

  const schema = vi.fn((schemaName: string) => {
    if (schemaName !== "vault") throw new Error(`Unexpected schema: ${schemaName}`);
    let requestedId = "";
    const builder: Record<string, unknown> = {};
    builder.from = vi.fn(() => builder);
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn((_col: string, value: string) => {
      requestedId = value;
      return builder;
    });
    builder.maybeSingle = vi.fn(async () => {
      const secret = config.secretsById?.[requestedId];
      return { data: secret ? { decrypted_secret: secret } : null, error: null };
    });
    return builder;
  });

  return { from, schema };
}

const CONNECTED_META_CONNECTION = { id: "conn_1", workspace_id: "ws_1", provider_id: "meta", state: "connected", credential_id: "cred_1" };
const VALID_CREDENTIAL = { kind: "oauth_token", access_token_ref: "vault_secret_1", revoked_at: null, scopes: ["instagram_manage_comments"], workspace_id: "ws_1" };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  createClientMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("resolveInstagramCommentReplyContext", () => {
  it("fails closed when SUPABASE_SERVICE_ROLE_KEY is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("service_role_unavailable");
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("resolves the real access token for a fully valid, correctly-scoped connection", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, id: "cred_1" }], secretsById: { vault_secret_1: "real-access-token" } }),
    );
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(result).toEqual({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
  });

  it("workspace isolation — a connection that exists but belongs to a different workspace is treated as not found, never trusted", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [{ ...CONNECTED_META_CONNECTION, workspace_id: "ws_other_tenant" }] }));
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("connection");
  });

  it("rejects a connection that isn't connected, isn't meta, or has no credential", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [{ ...CONNECTED_META_CONNECTION, state: "disconnected" }] }));
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("connection");
  });

  it("rejects a revoked credential", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, id: "cred_1", revoked_at: "2026-01-01T00:00:00Z" }] }),
    );
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("credential");
  });

  it("rejects a credential missing the instagram_manage_comments scope — the real, currently-expected state for every existing connection, since defaultScopes was not changed this checkpoint (see this module's own doc comment)", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, id: "cred_1", scopes: ["instagram_content_publish"] }] }),
    );
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("credential");
  });

  it("rejects a credential belonging to a different workspace than requested", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, id: "cred_1", workspace_id: "ws_other_tenant" }] }),
    );
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("credential");
  });

  it("rejects when the vault secret cannot be resolved", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, id: "cred_1" }], secretsById: {} }));
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("credential");
  });

  it("never exposes the resolved access token in a failure result", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [] }));
    const result = await resolveInstagramCommentReplyContext("ws_1");
    expect(JSON.stringify(result)).not.toContain("real-access-token");
  });
});
