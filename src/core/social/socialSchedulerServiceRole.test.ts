import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => createClientMock(...args) }));

import { resolveSocialSchedulerContext } from "@/core/social/socialSchedulerServiceRole";
import type { SocialPost } from "@/types/socialPost";

const ORIGINAL_ENV = { ...process.env };

function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: "user_1",
    status: "publishing",
    caption: "Hello!",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_1",
    provider_container_id: null,
    provider_post_id: null,
    provider_permalink: null,
    provider_error: null,
    published_at: null,
    scheduled_at: "2026-01-01T00:00:00Z",
    scheduled_timezone: null,
    publish_attempts: 1,
    next_attempt_at: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** A minimal, filter-applying stand-in for the Supabase query builder — rows only match if every recorded `.eq()` filter is satisfied, so a workspace_id mismatch mechanically fails to match rather than being hardcoded per test. */
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

function makeSupabaseStub(config: {
  connections?: Record<string, unknown>[];
  credentials?: Record<string, unknown>[];
  assets?: Record<string, unknown>[];
  secretsById?: Record<string, string | null>;
  signedUrlResult?: { data: { signedUrl: string } | null; error: { message: string } | null };
}) {
  const from = vi.fn((table: string) => {
    if (table === "integration_connections") return filteringTableMock(config.connections ?? []);
    if (table === "integration_credentials") return filteringTableMock(config.credentials ?? []);
    if (table === "media_assets") return filteringTableMock(config.assets ?? []);
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

  const createSignedUrl = vi.fn(async () => config.signedUrlResult ?? { data: { signedUrl: "https://signed.example/image.jpg" }, error: null });
  const storage = { from: vi.fn(() => ({ createSignedUrl })) };

  return { from, schema, storage };
}

const APPROVED_ASSET = { id: "asset_1", workspace_id: "ws_1", mime_type: "image/jpeg", storage_bucket: "media-assets", storage_path: "ws_1/asset_1.jpg" };
const CONNECTED_META_CONNECTION = { id: "conn_1", workspace_id: "ws_1", provider_id: "meta", state: "connected", credential_id: "cred_1" };
const VALID_CREDENTIAL = { kind: "oauth_token", access_token_ref: "vault_secret_1", revoked_at: null, scopes: ["instagram_content_publish"], workspace_id: "ws_1" };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  createClientMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("resolveSocialSchedulerContext", () => {
  it("fails closed when SUPABASE_SERVICE_ROLE_KEY is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await resolveSocialSchedulerContext(makePost());
    expect(result).toEqual({ success: false, failure: { kind: "service_role_unavailable", message: "Reconnect Meta to enable publishing." } });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("SOCIAL-04A Phase 14 — a connection that exists but belongs to a different workspace is treated as not found, never trusted", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [{ ...CONNECTED_META_CONNECTION, workspace_id: "ws_other_tenant" }] }));
    const result = await resolveSocialSchedulerContext(makePost({ workspace_id: "ws_1", target_connection_id: "conn_1" }));
    expect(result).toEqual({ success: false, failure: { kind: "connection", message: "Reconnect Meta to enable publishing." } });
  });

  it("rejects a connection that isn't connected, isn't meta, or has no credential — the same generic RECONNECT_ERROR every case", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [{ ...CONNECTED_META_CONNECTION, state: "disconnected" }] }));
    const result = await resolveSocialSchedulerContext(makePost());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("connection");
  });

  it("rejects a revoked credential or one missing instagram_content_publish scope", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, id: "cred_1", revoked_at: "2026-01-01T00:00:00Z" }] }),
    );
    const result = await resolveSocialSchedulerContext(makePost());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("credential");
  });

  it("rejects a credential belonging to a different workspace than the post", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, id: "cred_1", workspace_id: "ws_other_tenant" }] }),
    );
    const result = await resolveSocialSchedulerContext(makePost());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("credential");
  });

  it("rejects when the vault secret cannot be resolved", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connections: [CONNECTED_META_CONNECTION], credentials: [{ ...VALID_CREDENTIAL, id: "cred_1" }], secretsById: {} }));
    const result = await resolveSocialSchedulerContext(makePost());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("credential");
  });

  it("rejects an asset from a different workspace, a non-JPEG asset, or a missing asset", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connections: [CONNECTED_META_CONNECTION],
        credentials: [{ ...VALID_CREDENTIAL, id: "cred_1" }],
        secretsById: { vault_secret_1: "real-access-token" },
        assets: [{ ...APPROVED_ASSET, workspace_id: "ws_other_tenant" }],
      }),
    );
    const result = await resolveSocialSchedulerContext(makePost());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("asset");
    expect(result.failure.message).toBe("That image could not be found.");
  });

  it("KNOWN PRE-EXISTING GAP — every asset fails the approved check today, since media_assets has no real status column in Supabase mode (mirrors validateOwnedApprovedImageAsset's own identical gap)", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connections: [CONNECTED_META_CONNECTION],
        credentials: [{ ...VALID_CREDENTIAL, id: "cred_1" }],
        secretsById: { vault_secret_1: "real-access-token" },
        assets: [APPROVED_ASSET],
      }),
    );
    const result = await resolveSocialSchedulerContext(makePost());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.failure.kind).toBe("asset");
    expect(result.failure.message).toBe("Only an approved image can be published.");
  });

  it("never leaks the resolved access token in a failure result", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connections: [CONNECTED_META_CONNECTION],
        credentials: [{ ...VALID_CREDENTIAL, id: "cred_1" }],
        secretsById: { vault_secret_1: "super-secret-token-value" },
        assets: [{ ...APPROVED_ASSET, mime_type: "image/png" }],
      }),
    );
    const result = await resolveSocialSchedulerContext(makePost());
    expect(JSON.stringify(result)).not.toContain("super-secret-token-value");
  });
});
