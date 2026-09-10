import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/core/integrations/oauthTokenExchange", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/oauthTokenExchange")>("@/core/integrations/oauthTokenExchange");
  return { ...actual, exchangeAuthorizationCode: vi.fn(), refreshOAuthToken: vi.fn() };
});

vi.mock("@/core/integrations/providerFactory", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/providerFactory")>("@/core/integrations/providerFactory");
  return { ...actual, createProviderInstance: vi.fn() };
});

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { exchangeAuthorizationCode, refreshOAuthToken } from "@/core/integrations/oauthTokenExchange";
import { createProviderInstance } from "@/core/integrations/providerFactory";
import {
  beginProviderOAuthConnectionAction,
  completeProviderOAuthConnectionAction,
  disconnectOAuthProviderAction,
  getOwnProviderConnectionAction,
  refreshProviderOAuthConnectionAction,
  resolveConnectionAccessTokenForServer,
} from "@/modules/integrations/manageOAuthConnectionActions";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider, issueOAuthCredential, issueApiKeyCredential, getCredentialForConnection } from "@/core/integrations/credentialManager";
import { installProvider, attachCredential, applyConnectionEvent, getConnection } from "@/core/integrations/integrationManager";
import { resetOAuthEngine } from "@/core/integrations/oauthEngine";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["integrations.sensitive", "integrations.connect", "integrations.disconnect"],
  workspaceDisplayName: "Amoré Bloom",
};

const sessionWithoutPermission: MemberSessionSnapshot = { ...session, permissions: [] };

const crossTenantSession: MemberSessionSnapshot = {
  ...session,
  workspace: { id: "ws_other_tenant", name: "Other Workspace" },
  membership: { id: "member_other_ws", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

/** Same workspace, a genuinely different member — the case Gmail's member-owned model must deny access to. */
const otherMemberSession: MemberSessionSnapshot = {
  ...session,
  user: { id: "user_2", email: "jordan@amorebloom.com" },
  membership: { id: "member_2", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
  resetOAuthEngine();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function seedConnectionWithToken(): Promise<string> {
  const connection = await installProvider({ workspaceId: CURRENT_WORKSPACE_ID, providerId: "google-calendar", installedBy: "member_1" });
  const credential = await issueOAuthCredential({
    workspaceId: CURRENT_WORKSPACE_ID,
    connectionId: connection.id,
    scopes: [],
    createdBy: "member_1",
    accessToken: "real-access-token-value",
  });
  attachCredential(connection.id, credential.id);
  return connection.id;
}

describe("resolveConnectionAccessTokenForServer (v2 Checkpoint 45 security fix)", () => {
  it("resolves the real access token for an authorized, same-workspace caller", async () => {
    const connectionId = await seedConnectionWithToken();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);

    const token = await resolveConnectionAccessTokenForServer(connectionId);
    expect(token).toBe("real-access-token-value");
  });

  it("returns null with no active session", async () => {
    const connectionId = await seedConnectionWithToken();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });

    const token = await resolveConnectionAccessTokenForServer(connectionId);
    expect(token).toBeNull();
  });

  it("returns null for a caller missing integrations.sensitive", async () => {
    const connectionId = await seedConnectionWithToken();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionWithoutPermission);

    const token = await resolveConnectionAccessTokenForServer(connectionId);
    expect(token).toBeNull();
  });

  it("returns null for a cross-tenant caller, even with the right permission", async () => {
    const connectionId = await seedConnectionWithToken();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);

    const token = await resolveConnectionAccessTokenForServer(connectionId);
    expect(token).toBeNull();
  });

  it("returns null for a nonexistent connection id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const token = await resolveConnectionAccessTokenForServer("connection_nonexistent");
    expect(token).toBeNull();
  });
});

function mockConfiguredExchange(overrides: Partial<{ accessToken: string; refreshToken: string | null; expiresInSeconds: number | null }> = {}) {
  vi.mocked(exchangeAuthorizationCode).mockResolvedValue({
    configured: true,
    accessToken: overrides.accessToken ?? "real-access-token",
    refreshToken: overrides.refreshToken ?? "real-refresh-token",
    expiresInSeconds: overrides.expiresInSeconds ?? 3600,
  });
}

function mockPingOk() {
  vi.mocked(createProviderInstance).mockReturnValue({ ping: vi.fn().mockResolvedValue({ ok: true, latencyMs: 5 }) } as never);
}

async function beginAndComplete(providerId: string, callerSession: MemberSessionSnapshot) {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(callerSession);
  const begin = await beginProviderOAuthConnectionAction(providerId, "https://app.test/api/integrations/oauth/callback");
  if (!begin.success) throw new Error(`begin failed: ${begin.error}`);
  mockConfiguredExchange();
  mockPingOk();
  const complete = await completeProviderOAuthConnectionAction(providerId, "auth-code-123", begin.data.state, "https://app.test/api/integrations/oauth/callback");
  return { begin, complete };
}

describe("GMAIL-03R2-FIX1 — shared connect_requested → connecting → connect_succeeded transition", () => {
  it("fires connect_requested before beginAuthorization, moving a fresh connection to connecting", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const begin = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(begin.success).toBe(true);

    const own = await getOwnProviderConnectionAction("gmail");
    expect(own.success && own.data?.state).toBe("connecting");
  });

  it("lets the real completion path legally apply connect_succeeded after connect_requested, reaching connected", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    expect(complete.success).toBe(true);
    expect(complete.success && "state" in complete.data && complete.data.state).toBe("connected");
  });

  it("does not leave the connection stuck in connecting when beginAuthorization itself fails — rolls back via the existing connect_failed transition", async () => {
    const pendingStore = await import("@/lib/data/core/integrations/pendingOAuthAuthorizationStore");
    const insertSpy = vi.spyOn(pendingStore, "insertPendingAuthorization").mockRejectedValueOnce(new Error("store unavailable"));

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const begin = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(begin.success).toBe(false);

    const own = await getOwnProviderConnectionAction("gmail");
    expect(own.success && own.data?.state).toBe("failed");

    insertSpy.mockRestore();
  });

  it("rejects a fresh Connect attempt on an already-connected connection instead of forcing a re-entry", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    expect(complete.success).toBe(true);

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const secondBegin = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(secondBegin.success).toBe(false);
  });

  it("rejects a duplicate Connect attempt while one is already connecting", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const first = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(first.success).toBe(true);

    const second = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(second.success).toBe(false);
  });

  it("rejects Connect from an unsupported source state (disabled) safely, without throwing out of the action", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    const own = await getOwnProviderConnectionAction("gmail");
    const connectionId = own.success ? own.data?.id : undefined;
    expect(connectionId).toBeTruthy();
    await applyConnectionEvent(connectionId!, "connect_failed", "member_1");
    await applyConnectionEvent(connectionId!, "disable_requested", "member_1");

    const result = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(result.success).toBe(false);
  });

  it.each(["google-calendar", "google-drive", "docusign", "dropbox"] as const)(
    "%s's existing first-time OAuth semantics are otherwise unchanged — workspace-owned, connecting then connected, no ownership/scope change",
    async (providerId) => {
      const { complete } = await beginAndComplete(providerId, session);
      expect(complete.success).toBe(true);

      const own = await getOwnProviderConnectionAction(providerId);
      expect(own.success && own.data?.member_id).toBeNull();
      expect(own.success && own.data?.installed_by).toBe("member_1");
    },
  );
});

describe("Gmail member-owned connection lifecycle (GMAIL-03R2)", () => {
  it("begin sets the connection's member_id and installed_by to session.user.id, not session.membership.id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    const own = await getOwnProviderConnectionAction("gmail");
    expect(own.success && own.data?.member_id).toBe("user_1");
    expect(own.success && own.data?.installed_by).toBe("user_1");
  });

  it("two different members each get their own separate Gmail connection", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherMemberSession);
    await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");

    const ownAsUser2 = await getOwnProviderConnectionAction("gmail");
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const ownAsUser1 = await getOwnProviderConnectionAction("gmail");
    if (!ownAsUser2.success || !ownAsUser1.success) throw new Error("expected both lookups to succeed");
    expect(ownAsUser2.data?.member_id).toBe("user_2");
    expect(ownAsUser1.data?.member_id).toBe("user_1");
    expect(ownAsUser2.data?.id).not.toBe(ownAsUser1.data?.id);
  });

  it("completion happy path: real begin → complete flow reaches connected and issues a member-owned credential", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    expect(complete.success).toBe(true);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : undefined;
    expect(connectionId).toBeTruthy();

    const credential = await getCredentialForConnection(connectionId!);
    expect(credential?.member_id).toBe("user_1");
    expect(credential?.kind).toBe("oauth_token");
  });

  it("a different member cannot complete another member's own pending Gmail authorization", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const begin = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(begin.success).toBe(true);

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherMemberSession);
    mockConfiguredExchange();
    mockPingOk();
    const complete = await completeProviderOAuthConnectionAction("gmail", "auth-code", begin.success ? begin.data.state : "", "https://app.test/cb");
    expect(complete.success).toBe(false);
  });

  it("a cross-workspace caller cannot complete another workspace's pending Gmail authorization", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const begin = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(begin.success).toBe(true);

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    mockConfiguredExchange();
    mockPingOk();
    const complete = await completeProviderOAuthConnectionAction("gmail", "auth-code", begin.success ? begin.data.state : "", "https://app.test/cb");
    expect(complete.success).toBe(false);
  });

  it("reports pendingConfiguration, without consuming the pending state, when no OAuth client is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const begin = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(begin.success).toBe(true);
    vi.mocked(exchangeAuthorizationCode).mockResolvedValue({ configured: false, reason: "No OAuth client is configured for \"gmail\" in this environment." });

    const complete = await completeProviderOAuthConnectionAction("gmail", "auth-code", begin.success ? begin.data.state : "", "https://app.test/cb");
    expect(complete.success).toBe(true);
    expect(complete.success && "pendingConfiguration" in complete.data && complete.data.pendingConfiguration).toBe(true);
  });

  it("a real ping failure after a real token exchange leaves the connection short of connected, and reports failure", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const begin = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    expect(begin.success).toBe(true);
    mockConfiguredExchange();
    vi.mocked(createProviderInstance).mockReturnValue({ ping: vi.fn().mockResolvedValue({ ok: false, error: "invalid token" }) } as never);

    const complete = await completeProviderOAuthConnectionAction("gmail", "auth-code", begin.success ? begin.data.state : "", "https://app.test/cb");
    expect(complete.success).toBe(false);

    const own = await getOwnProviderConnectionAction("gmail");
    expect(own.success && own.data?.state).not.toBe("connected");
  });

  it("never returns a plaintext token anywhere in the completion result", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    expect(complete.success).toBe(true);
    expect(JSON.stringify(complete)).not.toContain("real-access-token");
    expect(JSON.stringify(complete)).not.toContain("real-refresh-token");
  });
});

describe("Disconnect ownership enforcement (GMAIL-03R2)", () => {
  it("the owning member can disconnect their own Gmail connection", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    expect(complete.success).toBe(true);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const result = await disconnectOAuthProviderAction(connectionId);
    expect(result.success).toBe(true);
  });

  it("denies a same-workspace, different member from disconnecting someone else's Gmail connection", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherMemberSession);
    const result = await disconnectOAuthProviderAction(connectionId);
    expect(result.success).toBe(false);

    const own = await getConnection(connectionId);
    expect(own?.state).toBe("connected");
  });

  it("denies a cross-workspace caller from disconnecting the connection", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await disconnectOAuthProviderAction(connectionId);
    expect(result.success).toBe(false);
  });
});

describe("refreshProviderOAuthConnectionAction (GMAIL-03R2)", () => {
  it("resolves the refresh token, calls refreshOAuthToken, and persists the rotated tokens encrypted", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";

    vi.mocked(refreshOAuthToken).mockResolvedValue({ configured: true, accessToken: "new-access", refreshToken: "new-refresh", expiresInSeconds: 3600 });
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const result = await refreshProviderOAuthConnectionAction(connectionId);

    expect(result.success).toBe(true);
    expect(result.success && result.data.state).toBe("connected");
    const credential = await getCredentialForConnection(connectionId);
    expect(credential?.access_token_ref).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain("new-access");
    expect(JSON.stringify(result)).not.toContain("new-refresh");
  });

  it("denies refresh for a credential that isn't oauth_token-kind", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";
    const connection = await getConnection(connectionId);
    const { credential } = await issueApiKeyCredential({ workspaceId: CURRENT_WORKSPACE_ID, connectionId, scopes: [], createdBy: "user_1" });
    await attachCredential(connectionId, credential.id);
    void connection;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const result = await refreshProviderOAuthConnectionAction(connectionId);
    expect(result.success).toBe(false);
  });

  it("denies refresh from a same-workspace, different member", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherMemberSession);
    const result = await refreshProviderOAuthConnectionAction(connectionId);
    expect(result.success).toBe(false);
    expect(refreshOAuthToken).not.toHaveBeenCalled();
  });

  it("denies refresh from a cross-workspace caller", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await refreshProviderOAuthConnectionAction(connectionId);
    expect(result.success).toBe(false);
  });

  it("transitions to expired and reports a safe, generic message when the provider rejects the refresh (revoked authorization)", async () => {
    const { complete } = await beginAndComplete("gmail", session);
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";

    vi.mocked(refreshOAuthToken).mockRejectedValue(new Error("OAuth token refresh failed for \"gmail\": 400 {\"error\":\"invalid_grant\",\"secret_detail\":\"leaked-provider-internal-detail\"}"));
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const result = await refreshProviderOAuthConnectionAction(connectionId);

    expect(result.success).toBe(false);
    expect(result.success || result.error).not.toContain("leaked-provider-internal-detail");
    const connection = await getConnection(connectionId);
    expect(connection?.state).toBe("expired");
  });

  it("transitions to expired and fails closed when the connection has no refresh token at all", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const begin = await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");
    mockPingOk();
    vi.mocked(exchangeAuthorizationCode).mockResolvedValue({ configured: true, accessToken: "access-only", refreshToken: null, expiresInSeconds: 3600 });
    const complete = await completeProviderOAuthConnectionAction("gmail", "auth-code", begin.success ? begin.data.state : "", "https://app.test/cb");
    const connectionId = complete.success && "id" in complete.data ? complete.data.id : "";

    const result = await refreshProviderOAuthConnectionAction(connectionId);
    expect(result.success).toBe(false);
    const connection = await getConnection(connectionId);
    expect(connection?.state).toBe("expired");
  });
});

describe("getOwnProviderConnectionAction (GMAIL-03R2)", () => {
  it("returns null when the caller has no connection of their own yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const result = await getOwnProviderConnectionAction("gmail");
    expect(result.success && result.data).toBeNull();
  });

  it("never returns a different member's own Gmail connection", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(otherMemberSession);
    await beginProviderOAuthConnectionAction("gmail", "https://app.test/cb");

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
    const result = await getOwnProviderConnectionAction("gmail");
    expect(result.success && result.data).toBeNull();
  });
});
