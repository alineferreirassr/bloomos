import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({ resolveMemberSessionSnapshot: vi.fn() }));

const { mockGetPrimaryCalendarAccountIdentity, mockListGoogleCalendars } = vi.hoisted(() => ({ mockGetPrimaryCalendarAccountIdentity: vi.fn(), mockListGoogleCalendars: vi.fn() }));
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity")>("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity");
  return { ...actual, getPrimaryCalendarAccountIdentity: mockGetPrimaryCalendarAccountIdentity };
});
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarListApi", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarListApi")>("@/core/integrations/googleCalendarReadonly/googleCalendarListApi");
  return { ...actual, listGoogleCalendars: mockListGoogleCalendars };
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
import { resetGoogleCalendarStore } from "@/lib/data/core/integrations/googleCalendarReadonly/calendarStore";
import { GOOGLE_CALENDAR_READONLY_SCOPE } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountService";
import {
  getMyGoogleCalendarsAction,
  getOwnGoogleCalendarAccountSummaryAction,
  identifyMyGoogleCalendarAccountAction,
  listMyGoogleCalendarsAction,
} from "@/modules/integrations/googleCalendarReadonly/googleCalendarAccountActions";

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
  resetGoogleCalendarStore();
  vi.clearAllMocks();
  mockGetPrimaryCalendarAccountIdentity.mockResolvedValue({ providerAccountId: "ana@amorebloom.com", providerAccountEmail: "ana@amorebloom.com" });
  mockListGoogleCalendars.mockResolvedValue({ items: [] });
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

describe("listMyGoogleCalendarsAction / getMyGoogleCalendarsAction (GCAL-03)", () => {
  async function identifyThenListWith(items: Array<Partial<{ id: string; summary: string; primary: boolean }>>) {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);
    await identifyMyGoogleCalendarAccountAction();
    mockListGoogleCalendars.mockResolvedValue({ items: items.map((item) => ({ id: "cal_1", summary: "Calendar", ...item })) });
    return listMyGoogleCalendarsAction();
  }

  it("33. requires an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" } as MemberSessionSnapshot);
    const result = await listMyGoogleCalendarsAction();
    expect(result.success).toBe(false);
  });

  it("33. requires integrations.calendar permission — server-side, not merely a UI check", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID, ["integrations.connect"]));
    const result = await listMyGoogleCalendarsAction();
    expect(result.success).toBe(false);
    expect(mockListGoogleCalendars).not.toHaveBeenCalled();
  });

  it("lists and persists the caller's own calendars, mapped to the safe summary shape", async () => {
    const result = await identifyThenListWith([{ id: "ana@amorebloom.com", summary: "Ana", primary: true }]);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    if (result.data.status !== "success") throw new Error("expected a success status");
    expect(result.data.calendars).toEqual([{ id: expect.any(String), summary: "Ana", description: null, timeZone: null, accessRole: null, isPrimary: true, isSelected: true }]);
  });

  it("29 & 39. never includes a token, and never exposes internal workspace_id/member_id/account_id fields", async () => {
    const result = await identifyThenListWith([{ id: "cal_1", primary: true }]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("real-access-token");
    expect(serialized).not.toContain("workspace_id");
    expect(serialized).not.toContain("member_id");
    expect(serialized).not.toContain("account_id");
  });

  it("13. a same-workspace, different member has no connection of their own to list", async () => {
    await seedConnectedAccount(WORKSPACE_ID, MEMBER_ID);
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    await identifyMyGoogleCalendarAccountAction();

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, OTHER_MEMBER_ID));
    const result = await listMyGoogleCalendarsAction();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.status).toBe("no_connection");
  });

  it("getMyGoogleCalendarsAction reads already-persisted calendars without calling the Google API", async () => {
    await identifyThenListWith([{ id: "ana@amorebloom.com", summary: "Ana", primary: true }]);
    mockListGoogleCalendars.mockClear();

    const result = await getMyGoogleCalendarsAction();
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].summary).toBe("Ana");
    expect(mockListGoogleCalendars).not.toHaveBeenCalled();
  });

  it("getMyGoogleCalendarsAction returns an empty array before any account exists", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, MEMBER_ID));
    const result = await getMyGoogleCalendarsAction();
    expect(result).toEqual({ success: true, data: [] });
  });

  it("13. denies a same-workspace, different member from reading persisted calendars", async () => {
    await identifyThenListWith([{ id: "cal_1", primary: true }]);

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(sessionFor(WORKSPACE_ID, OTHER_MEMBER_ID));
    const result = await getMyGoogleCalendarsAction();
    expect(result).toEqual({ success: true, data: [] });
  });
});
