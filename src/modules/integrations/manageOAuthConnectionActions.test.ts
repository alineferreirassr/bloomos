import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resolveConnectionAccessTokenForServer } from "@/modules/integrations/manageOAuthConnectionActions";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider, issueOAuthCredential } from "@/core/integrations/credentialManager";
import { installProvider, attachCredential } from "@/core/integrations/integrationManager";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["integrations.sensitive"],
  workspaceDisplayName: "Amoré Bloom",
};

const sessionWithoutPermission: MemberSessionSnapshot = { ...session, permissions: [] };

const crossTenantSession: MemberSessionSnapshot = {
  ...session,
  workspace: { id: "ws_other_tenant", name: "Other Workspace" },
  membership: { id: "member_other_ws", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
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
