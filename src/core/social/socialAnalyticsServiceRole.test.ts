import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => createClientMock(...args) }));

import { resolveWorkspaceAnalyticsContext } from "@/core/social/socialAnalyticsServiceRole";

const ORIGINAL_ENV = { ...process.env };

/** Same filter-applying stand-in socialSchedulerServiceRole.test.ts already establishes — rows only match if every recorded `.eq()` filter is satisfied. */
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

const CONNECTED_META_CONNECTION = { id: "conn_1", workspace_id: "ws_1", provider_id: "meta", state: "connected", credential_id: "cred_1", config: { meta_instagram_account_id: "ig_1" } };
const VALID_CREDENTIAL = { id: "cred_1", kind: "oauth_token", access_token_ref: "vault_secret_1", revoked_at: null, scopes: ["instagram_manage_insights"], workspace_id: "ws_1" };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  createClientMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("resolveWorkspaceAnalyticsContext", () => {
  it("fails closed when SUPABASE_SERVICE_ROLE_KEY is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: false, reason: "service_role_unavailable" });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("resolves the access token and the selected Instagram account id for a valid, scoped connection", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [VALID_CREDENTIAL], secretsById: { vault_secret_1: "real-access-token" } }));
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: true, context: { connectionId: "conn_1", instagramAccountId: "ig_1", accessToken: "real-access-token" } });
  });

  it("resolves with instagramAccountId null (skip, not fail) when no Instagram identity has been selected yet", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connections: [{ ...CONNECTED_META_CONNECTION, config: {} }],
        credentials: [VALID_CREDENTIAL],
        secretsById: { vault_secret_1: "real-access-token" },
      }),
    );
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: true, context: { connectionId: "conn_1", instagramAccountId: null, accessToken: "real-access-token" } });
  });

  it("a connection that exists but belongs to a different workspace is treated as not found, never trusted", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [{ ...CONNECTED_META_CONNECTION, workspace_id: "ws_other_tenant" }] }));
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: false, reason: "connection" });
  });

  it("rejects a connection that isn't connected or isn't meta", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [{ ...CONNECTED_META_CONNECTION, state: "disconnected" }] }));
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: false, reason: "connection" });
  });

  it("rejects a credential missing instagram_manage_insights — a SOCIAL-02/03-era connection without the analytics scope is not silently treated as ready", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, scopes: ["instagram_content_publish"] }] }));
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: false, reason: "credential" });
  });

  it("rejects a revoked credential", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, revoked_at: "2026-01-01T00:00:00Z" }] }));
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: false, reason: "credential" });
  });

  it("rejects a credential belonging to a different workspace than requested", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, workspace_id: "ws_other_tenant" }] }));
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: false, reason: "credential" });
  });

  it("rejects when the vault secret cannot be resolved", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [VALID_CREDENTIAL], secretsById: {} }));
    const result = await resolveWorkspaceAnalyticsContext("ws_1", "conn_1");
    expect(result).toEqual({ success: false, reason: "credential" });
  });

  it("never resolves a connection id that requires a workspace_id parameter mismatch to match", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [{ ...CONNECTED_META_CONNECTION, id: "conn_1" }] }));
    const result = await resolveWorkspaceAnalyticsContext("ws_impersonator", "conn_1");
    expect(result).toEqual({ success: false, reason: "connection" });
  });
});
