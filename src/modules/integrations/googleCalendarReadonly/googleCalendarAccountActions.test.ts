import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

const { mockGetPrimaryCalendarAccountIdentity } = vi.hoisted(() => ({ mockGetPrimaryCalendarAccountIdentity: vi.fn() }));
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity")>("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity");
  return { ...actual, getPrimaryCalendarAccountIdentity: mockGetPrimaryCalendarAccountIdentity };
});

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { Permission } from "@/core/enums/permission";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider, issueOAuthCredential } from "@/core/integrations/credentialManager";
import { installProvider, attachCredential, applyConnectionEvent } from "@/core/integrations/integrationManager";
import { resetGoogleCalendarAccountStore } from "@/lib/data/core/integrations/googleCalendarReadonly/accountStore";
import { GOOGLE_CALENDAR_READONLY_SCOPE } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountService";
import { getOwnGoogleCalendarAccountSummaryAction, identifyMyGoogleCalendarAccountAction } from "@/modules/integrations/googleCalendarReadonly/googleCalendarAccountActions";

registerBuiltinProviders();

const WORKSPACE_ID = "ws_1";
const OTHER_WORKSPACE_ID = "ws_other";
const MEMBER_ID = "user_1";
const OTHER_MEMBER_ID = "user_2";

function sessionFor(workspaceId: string, memberId: string, permissions: Permission[] = ["integrations.calendar", "integrations.connect"]): Extract<MemberSessionSnapshot, { kind: "active" }> {
  return {
    kind: "active",
    user: { id: memberId, email: `${memberId}@amorebloom.com` },
    profile: { full_name: "Test Member", avatar_url: null },
    workspace: { id: workspaceId, name: "Amoré Bloom" },
    membership: { id: `member_${memberId}`, role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
    permissions,
    workspaceDisplayName: "Amoré Bloom",
  };
}

async function seedConnectedAccount(workspaceId: string, memberId: string): Promise<string> {
  const connection = await installProvider({ workspaceId, providerId: "google-calendar-readonly", installedBy: memberId, memberId });
  await applyConnectionEvent(connection.id, "connect_requested", memberId);
  const credential = await issueOAuthCredential({
    workspaceId,
    connectionId: connection.id,
    scopes: [GOOGLE_CALENDAR_READONLY_SCOPE],
    createdBy: memberId,
    accessToken: "real-access-token",
    memberId,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  await attachCredential(connection.id, credential.id);
  await applyConnectionEvent(connection.id, "connect_succeeded", memberId);
  return connection.id;
}

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
  resetGoogleCalendarAccountStore();
  vi.clearAllMocks();
  mockGetPrimaryCalendarAccountIdentity.mockResolvedValue({ providerAccountId: "ana@amorebloom.com", providerAccountEmail: "ana@amorebloom.com" });
});

describe("identifyMyGoogleCalendarAccountAction", () => {
  it("33. requires an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as MemberSessionSnapshot);
    const result = await identifyMyGoogleCalendarAccountAction();
    expect(result.success).toBe(false);
  });

  it("33. requires integrations.calendar permission — server-side, not merely a UI check", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID, ["integrations.connect"]));
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);
    const result = await identifyMyGoogleCalendarAccountAction();
    expect(result.success).toBe(false);
    expect(mockGetPrimaryCalendarAccountIdentity).not.toHaveBeenCalled();
  });

  it("identifies the caller's own account, deriving workspace/member from the session only", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);

    const result = await identifyMyGoogleCalendarAccountAction();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.status).toBe("success");
  });

  it("29. never includes a token in the returned result", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);

    const result = await identifyMyGoogleCalendarAccountAction();
    expect(JSON.stringify(result)).not.toContain("real-access-token");
  });

  it("13. a same-workspace, different member has no connection of their own to identify", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, OTHER_MEMBER_ID));
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);

    const result = await identifyMyGoogleCalendarAccountAction();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.status).toBe("no_connection");
  });

  it("14. a cross-workspace caller has no connection in that workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(OTHER_WORKSPACE_ID, MEMBER_ID));
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);

    const result = await identifyMyGoogleCalendarAccountAction();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.status).toBe("no_connection");
  });
});

describe("getOwnGoogleCalendarAccountSummaryAction", () => {
  it("returns null when no account has been identified yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);

    const result = await getOwnGoogleCalendarAccountSummaryAction();
    expect(result).toEqual({ success: true, data: null });
  });

  it("returns the safe summary — never a token, never calendar/event content — after identification", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);
    await identifyMyGoogleCalendarAccountAction();

    const result = await getOwnGoogleCalendarAccountSummaryAction();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data?.providerAccountEmail).toBe("ana@amorebloom.com");
    expect(result.data?.syncStatus).toBe("synced");
    expect(Object.keys(result.data ?? {})).not.toContain("accessToken");
  });

  it("13. denies a same-workspace, different member from reading the account summary", async () => {
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await identifyMyGoogleCalendarAccountAction();

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, OTHER_MEMBER_ID));
    const result = await getOwnGoogleCalendarAccountSummaryAction();
    expect(result).toEqual({ success: true, data: null });
  });
});
