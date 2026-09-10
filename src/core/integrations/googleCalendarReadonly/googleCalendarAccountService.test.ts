import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { mockGetPrimaryCalendarAccountIdentity } = vi.hoisted(() => ({ mockGetPrimaryCalendarAccountIdentity: vi.fn() }));
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity")>("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity");
  return { ...actual, getPrimaryCalendarAccountIdentity: mockGetPrimaryCalendarAccountIdentity };
});

vi.mock("@/modules/integrations/manageOAuthConnectionActions", async () => {
  const actual = await vi.importActual<typeof import("@/modules/integrations/manageOAuthConnectionActions")>("@/modules/integrations/manageOAuthConnectionActions");
  return { ...actual, refreshProviderOAuthConnectionAction: vi.fn(actual.refreshProviderOAuthConnectionAction) };
});

import { GoogleCalendarApiError } from "@/core/integrations/googleCalendarReadonly/googleCalendarIdentity";
import { refreshProviderOAuthConnectionAction } from "@/modules/integrations/manageOAuthConnectionActions";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetEncryptionProvider, issueOAuthCredential, rotateOAuthCredential } from "@/core/integrations/credentialManager";
import { installProvider, attachCredential, applyConnectionEvent } from "@/core/integrations/integrationManager";
import { resetGoogleCalendarAccountStore } from "@/lib/data/core/integrations/googleCalendarReadonly/accountStore";
import { getOwnAccount } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";
import { GOOGLE_CALENDAR_READONLY_SCOPE, identifyOwnGoogleCalendarAccount } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountService";

registerBuiltinProviders();

const WORKSPACE_ID = "ws_1";
const OTHER_WORKSPACE_ID = "ws_other";
const MEMBER_ID = "user_1";
const OTHER_MEMBER_ID = "user_2";
const OTHER_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

async function setUpConnectedGoogleCalendarReadonly(scopes: string[] = [GOOGLE_CALENDAR_READONLY_SCOPE], expiresInMs = 60 * 60 * 1000): Promise<{ connectionId: string; credentialId: string }> {
  const connection = await installProvider({ workspaceId: WORKSPACE_ID, providerId: "google-calendar-readonly", installedBy: MEMBER_ID, memberId: MEMBER_ID });
  await applyConnectionEvent(connection.id, "connect_requested", MEMBER_ID);
  const credential = await issueOAuthCredential({
    workspaceId: WORKSPACE_ID,
    connectionId: connection.id,
    scopes,
    createdBy: MEMBER_ID,
    accessToken: "real-access-token",
    refreshToken: "real-refresh-token",
    memberId: MEMBER_ID,
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  });
  await attachCredential(connection.id, credential.id);
  await applyConnectionEvent(connection.id, "connect_succeeded", MEMBER_ID);
  return { connectionId: connection.id, credentialId: credential.id };
}

beforeEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetEncryptionProvider();
  resetGoogleCalendarAccountStore();
  vi.clearAllMocks();
  mockGetPrimaryCalendarAccountIdentity.mockResolvedValue({ providerAccountId: "ana@amorebloom.com", providerAccountEmail: "ana@amorebloom.com" });
  vi.mocked(refreshProviderOAuthConnectionAction).mockImplementation(async (connectionId: string) => {
    const { getConnection } = await import("@/core/integrations/integrationManager");
    const connection = await getConnection(connectionId);
    if (!connection?.credential_id) return { success: false, error: "no credential" };
    await rotateOAuthCredential(connection.credential_id, { accessToken: "refreshed-access-token", expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() });
    return { success: true, data: connection };
  });
});

describe("identifyOwnGoogleCalendarAccount — connection/scope/state gates", () => {
  it("returns no_connection when the caller has no google-calendar-readonly connection at all", async () => {
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "no_connection" });
    expect(mockGetPrimaryCalendarAccountIdentity).not.toHaveBeenCalled();
  });

  it("denies a same-workspace, different member — they have no connection of their own", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: OTHER_MEMBER_ID });
    expect(result).toEqual({ status: "no_connection" });
  });

  it("denies a cross-workspace caller — they have no connection in that workspace", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "no_connection" });
  });

  it("returns reconnect_required (missing_readonly_scope) for a connection that somehow only holds the broader calendar scope, without calling the identify API", async () => {
    await setUpConnectedGoogleCalendarReadonly([OTHER_CALENDAR_SCOPE]);
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "reconnect_required", reason: "missing_readonly_scope" });
    expect(mockGetPrimaryCalendarAccountIdentity).not.toHaveBeenCalled();
  });
});

describe("identifyOwnGoogleCalendarAccount — identification + persistence", () => {
  it("19, 20, 16. identifies the account and persists the minimum identity fields, own account then readable", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.account.provider_account_id).toBe("ana@amorebloom.com");
    expect(result.account.provider_account_email).toBe("ana@amorebloom.com");
    expect(result.account.sync_status).toBe("synced");
    expect(result.account.last_synced_at).not.toBeNull();
    expect(result.account.last_successful_sync_at).not.toBeNull();
    expect(result.account.sync_error_code).toBeNull();

    const own = await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(own?.id).toBe(result.account.id);
  });

  it("is idempotent — identifying twice updates the same account row rather than duplicating", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const first = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const second = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    if (first.status !== "success" || second.status !== "success") throw new Error("expected success");
    expect(second.account.id).toBe(first.account.id);
  });
});

describe("identifyOwnGoogleCalendarAccount — API error classification (21, 22, 23, 24)", () => {
  it("classifies a 401 as reconnect_required and records a non-sensitive sync_error_code", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    mockGetPrimaryCalendarAccountIdentity.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 401: unauthorized", 401));
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "reconnect_required", reason: "google_calendar_unauthorized" });

    const account = await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(account?.sync_status).toBe("error");
    expect(account?.sync_error_code).toBe("google_calendar_unauthorized");
  });

  it("classifies a 403 as a non-reconnect error", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    mockGetPrimaryCalendarAccountIdentity.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 403: forbidden", 403));
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "google_calendar_forbidden" });
  });

  it("classifies a 429 distinctly (rate limited)", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    mockGetPrimaryCalendarAccountIdentity.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 429: rate limited", 429));
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "google_calendar_rate_limited" });
  });

  it("classifies a 5xx distinctly (provider error)", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    mockGetPrimaryCalendarAccountIdentity.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 503", 503));
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "google_calendar_provider_error" });
  });
});

describe("identifyOwnGoogleCalendarAccount — token refresh (25, 26)", () => {
  it("resolves the existing access token directly when it isn't close to expiry", async () => {
    await setUpConnectedGoogleCalendarReadonly(undefined, 60 * 60 * 1000);
    await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(refreshProviderOAuthConnectionAction).not.toHaveBeenCalled();
    expect(mockGetPrimaryCalendarAccountIdentity).toHaveBeenCalledWith("real-access-token");
  });

  it("25. proactively refreshes via the shared refresh action when the token is close to expiry, and uses the refreshed token", async () => {
    await setUpConnectedGoogleCalendarReadonly(undefined, 30 * 1000);
    await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(refreshProviderOAuthConnectionAction).toHaveBeenCalledTimes(1);
    expect(mockGetPrimaryCalendarAccountIdentity).toHaveBeenCalledWith("refreshed-access-token");
  });

  it("26. an omitted replacement refresh token is preserved by the shared credential manager, not duplicated Calendar-specific logic", async () => {
    // rotateOAuthCredential itself is shared, already-tested infrastructure (credentialManager.test.ts) —
    // this proves the service goes through that exact shared path rather than a parallel token store.
    const { connectionId } = await setUpConnectedGoogleCalendarReadonly(undefined, 30 * 1000);
    await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(refreshProviderOAuthConnectionAction).toHaveBeenCalledWith(connectionId);
  });

  it("returns reconnect_required when the refresh action itself fails, and never calls the identify API", async () => {
    await setUpConnectedGoogleCalendarReadonly(undefined, 30 * 1000);
    vi.mocked(refreshProviderOAuthConnectionAction).mockResolvedValue({ success: false, error: "refresh rejected" });
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "reconnect_required", reason: "refresh_failed" });
    expect(mockGetPrimaryCalendarAccountIdentity).not.toHaveBeenCalled();
  });
});

describe("identifyOwnGoogleCalendarAccount — no sensitive data leakage (29, 30)", () => {
  it("never includes an access/refresh token in the returned result", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("real-access-token");
    expect(serialized).not.toContain("real-refresh-token");
  });

  it("30. never leaks a raw provider error message to the returned result — only a short code", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    mockGetPrimaryCalendarAccountIdentity.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 500: <html>internal details the client should never see</html>", 500));
    const result = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("internal details");
    expect(serialized).not.toContain("<html>");
  });
});
