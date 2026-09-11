import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const createClientMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: (...args: unknown[]) => createClientMock(...args) }));

import { resolveDocuSignWebhookContext, reconcileVerifiedDocuSignEnvelope } from "@/core/integrations/providers/docusign/trustedReconciliation";

const ORIGINAL_ENV = { ...process.env };

/** A tiny fluent stand-in for the Supabase query builder chain this module actually calls. */
function tableMock(rows: Record<string, unknown> | null) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: rows, error: null }));
  return builder;
}

function makeSupabaseStub(config: {
  connection?: Record<string, unknown> | null;
  credentialsById?: Record<string, Record<string, unknown> | null>;
  secretsById?: Record<string, string | null>;
  rpcResult?: { data: unknown; error: { message: string } | null };
}) {
  const from = vi.fn((table: string) => {
    if (table === "integration_connections") return tableMock(config.connection ?? null);
    if (table === "integration_credentials") {
      // eq() records the last-requested id via a captured closure below.
      const builder: Record<string, unknown> = {};
      let requestedId = "";
      builder.select = vi.fn(() => builder);
      builder.eq = vi.fn((_col: string, value: string) => {
        requestedId = value;
        return builder;
      });
      builder.maybeSingle = vi.fn(async () => ({ data: config.credentialsById?.[requestedId] ?? null, error: null }));
      return builder;
    }
    throw new Error(`Unexpected table in test stub: ${table}`);
  });

  const schema = vi.fn((schemaName: string) => {
    if (schemaName !== "vault") throw new Error(`Unexpected schema in test stub: ${schemaName}`);
    const builder: Record<string, unknown> = {};
    let requestedId = "";
    builder.from = vi.fn((table: string) => {
      if (table !== "decrypted_secrets") throw new Error(`Unexpected vault table: ${table}`);
      return builder;
    });
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

  const rpc = vi.fn(async () => config.rpcResult ?? { data: null, error: null });

  return { from, schema, rpc };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  createClientMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("resolveDocuSignWebhookContext", () => {
  it("returns null when SUPABASE_SERVICE_ROLE_KEY is not configured — fails closed", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await resolveDocuSignWebhookContext("conn_1");
    expect(result).toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("never sends the service-role key anywhere but the client constructor's own second argument", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connection: null }));
    await resolveDocuSignWebhookContext("conn_1");
    expect(createClientMock).toHaveBeenCalledWith("https://project.supabase.co", "test-service-role-key", expect.any(Object));
  });

  it("returns null for an unknown connection", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ connection: null }));
    const result = await resolveDocuSignWebhookContext("conn_missing");
    expect(result).toBeNull();
  });

  it("returns null for a connection belonging to a different provider", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ connection: { id: "conn_1", workspace_id: "ws_1", provider_id: "stripe", credential_id: null, config: {} } }),
    );
    const result = await resolveDocuSignWebhookContext("conn_1");
    expect(result).toBeNull();
  });

  it("returns null when no webhook_secret_credential_id is configured", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ connection: { id: "conn_1", workspace_id: "ws_1", provider_id: "docusign", credential_id: null, config: {} } }),
    );
    const result = await resolveDocuSignWebhookContext("conn_1");
    expect(result).toBeNull();
  });

  it("returns null when the webhook secret credential cannot be resolved from the vault", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connection: { id: "conn_1", workspace_id: "ws_1", provider_id: "docusign", credential_id: null, config: { webhook_secret_credential_id: "cred_secret" } },
        credentialsById: { cred_secret: { kind: "provider_secret", access_token_ref: "vault_secret_1", revoked_at: null } },
        secretsById: {},
      }),
    );
    const result = await resolveDocuSignWebhookContext("conn_1");
    expect(result).toBeNull();
  });

  it("returns null when the webhook secret credential is revoked", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connection: { id: "conn_1", workspace_id: "ws_1", provider_id: "docusign", credential_id: null, config: { webhook_secret_credential_id: "cred_secret" } },
        credentialsById: { cred_secret: { kind: "provider_secret", access_token_ref: "vault_secret_1", revoked_at: "2026-01-01T00:00:00Z" } },
        secretsById: { vault_secret_1: "connect_secret" },
      }),
    );
    const result = await resolveDocuSignWebhookContext("conn_1");
    expect(result).toBeNull();
  });

  it("resolves the webhook secret with no OAuth credential configured — accessToken stays null", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connection: { id: "conn_1", workspace_id: "ws_1", provider_id: "docusign", credential_id: null, config: { webhook_secret_credential_id: "cred_secret" } },
        credentialsById: { cred_secret: { kind: "provider_secret", access_token_ref: "vault_secret_1", revoked_at: null } },
        secretsById: { vault_secret_1: "connect_secret" },
      }),
    );
    const result = await resolveDocuSignWebhookContext("conn_1");
    expect(result).toEqual({ connectionId: "conn_1", workspaceId: "ws_1", webhookSecret: "connect_secret", accessToken: null, accountId: null, accountBaseUri: null });
  });

  it("resolves the full context — webhook secret, OAuth access token, and account identity", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connection: {
          id: "conn_1",
          workspace_id: "ws_1",
          provider_id: "docusign",
          credential_id: "cred_oauth",
          config: { webhook_secret_credential_id: "cred_secret", docusign_account_id: "acct_1", docusign_account_base_uri: "https://demo.docusign.net" },
        },
        credentialsById: {
          cred_secret: { kind: "provider_secret", access_token_ref: "vault_secret_1", revoked_at: null },
          cred_oauth: { kind: "oauth_token", access_token_ref: "vault_secret_2", revoked_at: null },
        },
        secretsById: { vault_secret_1: "connect_secret", vault_secret_2: "tok_123" },
      }),
    );
    const result = await resolveDocuSignWebhookContext("conn_1");
    expect(result).toEqual({
      connectionId: "conn_1",
      workspaceId: "ws_1",
      webhookSecret: "connect_secret",
      accessToken: "tok_123",
      accountId: "acct_1",
      accountBaseUri: "https://demo.docusign.net",
    });
  });

  it("leaves accessToken null when the OAuth credential is revoked, without failing the whole lookup", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({
        connection: {
          id: "conn_1",
          workspace_id: "ws_1",
          provider_id: "docusign",
          credential_id: "cred_oauth",
          config: { webhook_secret_credential_id: "cred_secret" },
        },
        credentialsById: {
          cred_secret: { kind: "provider_secret", access_token_ref: "vault_secret_1", revoked_at: null },
          cred_oauth: { kind: "oauth_token", access_token_ref: "vault_secret_2", revoked_at: "2026-01-01T00:00:00Z" },
        },
        secretsById: { vault_secret_1: "connect_secret", vault_secret_2: "tok_123" },
      }),
    );
    const result = await resolveDocuSignWebhookContext("conn_1");
    expect(result?.webhookSecret).toBe("connect_secret");
    expect(result?.accessToken).toBeNull();
  });
});

describe("reconcileVerifiedDocuSignEnvelope", () => {
  it("returns a no-op result when SUPABASE_SERVICE_ROLE_KEY is not configured — fails closed", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const result = await reconcileVerifiedDocuSignEnvelope({ connectionId: "conn_1", envelopeId: "env_1", mappedStatus: "signed" });
    expect(result).toEqual({ mutated: false, contractId: null, workspaceId: null, clientId: null });
  });

  it("calls the RPC with exactly connectionId/envelopeId/mappedStatus — never a contract id or arbitrary status", async () => {
    const stub = makeSupabaseStub({ rpcResult: { data: [{ mutated: true, contract_id: "contract_1", workspace_id: "ws_1", client_id: "client_1" }], error: null } });
    createClientMock.mockReturnValue(stub);
    await reconcileVerifiedDocuSignEnvelope({ connectionId: "conn_1", envelopeId: "env_1", mappedStatus: "signed" });
    expect(stub.rpc).toHaveBeenCalledWith("reconcile_docusign_envelope_status", { p_connection_id: "conn_1", p_envelope_id: "env_1", p_mapped_status: "signed" });
  });

  it("reports mutated:true with the reconciled Contract identity on success", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ rpcResult: { data: [{ mutated: true, contract_id: "contract_1", workspace_id: "ws_1", client_id: "client_1" }], error: null } }),
    );
    const result = await reconcileVerifiedDocuSignEnvelope({ connectionId: "conn_1", envelopeId: "env_1", mappedStatus: "signed" });
    expect(result).toEqual({ mutated: true, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });
  });

  it("reports mutated:false for a duplicate/no-op RPC result without throwing", async () => {
    createClientMock.mockReturnValue(
      makeSupabaseStub({ rpcResult: { data: [{ mutated: false, contract_id: "contract_1", workspace_id: "ws_1", client_id: "client_1" }], error: null } }),
    );
    const result = await reconcileVerifiedDocuSignEnvelope({ connectionId: "conn_1", envelopeId: "env_1", mappedStatus: "signed" });
    expect(result.mutated).toBe(false);
  });

  it("fails closed (mutated:false, no throw) when the RPC itself errors", async () => {
    createClientMock.mockReturnValue(makeSupabaseStub({ rpcResult: { data: null, error: { message: "db unavailable" } } }));
    const result = await reconcileVerifiedDocuSignEnvelope({ connectionId: "conn_1", envelopeId: "env_1", mappedStatus: "declined" });
    expect(result).toEqual({ mutated: false, contractId: null, workspaceId: null, clientId: null });
  });
});
