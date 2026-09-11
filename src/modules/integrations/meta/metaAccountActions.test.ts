import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { discoverMetaAccountsAction, getSelectedMetaPublishingIdentityAction, selectMetaPublishingIdentityAction } from "@/modules/integrations/meta/metaAccountActions";
import { installProvider, attachCredential, applyConnectionEvent } from "@/core/integrations/integrationManager";
import { issueOAuthCredential, resetEncryptionProvider } from "@/core/integrations/credentialManager";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: CURRENT_WORKSPACE_ID, name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

const sessionWithoutPermission: MemberSessionSnapshot = { ...session, permissions: [] };

const crossTenantSession: MemberSessionSnapshot = {
  ...session,
  workspace: { id: "ws_other_tenant", name: "Other Workspace" },
  membership: { id: "member_other_ws", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
};

async function connectMetaWithToken(accessToken = "real-meta-access-token"): Promise<string> {
  const connection = await installProvider({ workspaceId: CURRENT_WORKSPACE_ID, providerId: "meta", installedBy: "member_1" });
  const credential = await issueOAuthCredential({ workspaceId: CURRENT_WORKSPACE_ID, connectionId: connection.id, scopes: [], createdBy: "member_1", accessToken });
  await attachCredential(connection.id, credential.id);
  await applyConnectionEvent(connection.id, "connect_requested", "member_1");
  await applyConnectionEvent(connection.id, "connect_succeeded", "member_1");
  return connection.id;
}

const GRAPH_PAGES_RESPONSE = {
  data: [
    { id: "page_1", name: "Amoré Bloom", instagram_business_account: { id: "ig_1", username: "amorebloom" } },
    { id: "page_2", name: "Amoré Bloom Weddings" },
  ],
};

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("discoverMetaAccountsAction", () => {
  it("fails honestly when no Meta connection exists yet", async () => {
    const result = await discoverMetaAccountsAction();
    expect(result.success).toBe(false);
  });

  it("fails when the acting member lacks workspace.manage", async () => {
    await connectMetaWithToken();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionWithoutPermission);
    const result = await discoverMetaAccountsAction();
    expect(result.success).toBe(false);
  });

  it("returns real Pages with their linked Instagram account via one live Graph API call", async () => {
    await connectMetaWithToken();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(GRAPH_PAGES_RESPONSE), { status: 200 })),
    );
    const result = await discoverMetaAccountsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([
      { id: "page_1", name: "Amoré Bloom", instagramAccountId: "ig_1", instagramUsername: "amorebloom" },
      { id: "page_2", name: "Amoré Bloom Weddings", instagramAccountId: null, instagramUsername: null },
    ]);
  });

  it("reports a reconnect-required error, never a raw provider error, when the token is rejected", async () => {
    await connectMetaWithToken();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190, type: "OAuthException" } }), { status: 401 })),
    );
    const result = await discoverMetaAccountsAction();
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/reconnect/i);
    expect(result.error).not.toContain("real-meta-access-token");
  });

  it("never exposes the access token in its own success or failure result", async () => {
    await connectMetaWithToken("super-secret-token-value");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(GRAPH_PAGES_RESPONSE), { status: 200 })),
    );
    const result = await discoverMetaAccountsAction();
    expect(JSON.stringify(result)).not.toContain("super-secret-token-value");
  });

  it("a cross-workspace caller sees no Meta connection at all, not another workspace's real one", async () => {
    await connectMetaWithToken();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(crossTenantSession);
    const result = await discoverMetaAccountsAction();
    expect(result.success).toBe(false);
  });
});

describe("getSelectedMetaPublishingIdentityAction", () => {
  it("returns null when no Page has ever been selected", async () => {
    await connectMetaWithToken();
    const result = await getSelectedMetaPublishingIdentityAction();
    expect(result).toEqual({ success: true, data: null });
  });

  it("returns null (not an error) when there is no Meta connection at all", async () => {
    const result = await getSelectedMetaPublishingIdentityAction();
    expect(result).toEqual({ success: true, data: null });
  });
});

describe("selectMetaPublishingIdentityAction", () => {
  it("persists the selection only after re-verifying it against Meta's own live Page list", async () => {
    await connectMetaWithToken();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(GRAPH_PAGES_RESPONSE), { status: 200 })),
    );

    const result = await selectMetaPublishingIdentityAction({ id: "page_1" });
    expect(result).toEqual({ success: true, data: { pageId: "page_1", pageName: "Amoré Bloom", instagramAccountId: "ig_1", instagramUsername: "amorebloom" } });

    const selected = await getSelectedMetaPublishingIdentityAction();
    expect(selected).toEqual({ success: true, data: { pageId: "page_1", pageName: "Amoré Bloom", instagramAccountId: "ig_1", instagramUsername: "amorebloom" } });
  });

  it("denies selecting a Page id that Meta's own live list does not actually contain — never trusts the caller-supplied id blindly", async () => {
    await connectMetaWithToken();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(GRAPH_PAGES_RESPONSE), { status: 200 })),
    );

    const result = await selectMetaPublishingIdentityAction({ id: "foreign_page_999" });
    expect(result.success).toBe(false);

    const selected = await getSelectedMetaPublishingIdentityAction();
    expect(selected).toEqual({ success: true, data: null });
  });

  it("fails when the acting member lacks workspace.manage", async () => {
    await connectMetaWithToken();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionWithoutPermission);
    const result = await selectMetaPublishingIdentityAction({ id: "page_1" });
    expect(result.success).toBe(false);
  });
});
