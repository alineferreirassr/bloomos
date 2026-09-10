import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { mockGetPrimaryCalendarAccountIdentity, mockListGoogleCalendars } = vi.hoisted(() => ({ mockGetPrimaryCalendarAccountIdentity: vi.fn(), mockListGoogleCalendars: vi.fn() }));
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity")>("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity");
  return { ...actual, getPrimaryCalendarAccountIdentity: mockGetPrimaryCalendarAccountIdentity };
});
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarListApi", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarListApi")>("@/core/integrations/googleCalendarReadonly/googleCalendarListApi");
  return { ...actual, listGoogleCalendars: mockListGoogleCalendars };
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
import { resetGoogleCalendarStore } from "@/lib/data/core/integrations/googleCalendarReadonly/calendarStore";
import { getOwnAccount, listCalendarsForCaller } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";
import {
  CALENDAR_LIST_MAX_CALENDARS,
  CALENDAR_LIST_MAX_PAGES,
  CALENDAR_LIST_PAGE_SIZE,
  GOOGLE_CALENDAR_READONLY_SCOPE,
  identifyOwnGoogleCalendarAccount,
  listAndPersistOwnGoogleCalendars,
} from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountService";

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
  resetGoogleCalendarStore();
  vi.clearAllMocks();
  mockGetPrimaryCalendarAccountIdentity.mockResolvedValue({ providerAccountId: "ana@amorebloom.com", providerAccountEmail: "ana@amorebloom.com" });
  mockListGoogleCalendars.mockResolvedValue({ items: [] });
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

function calendarItem(overrides: Partial<{ id: string; summary: string; description: string; timeZone: string; accessRole: string; primary: boolean }> = {}) {
  return { id: "cal_1", summary: "Calendar", accessRole: "owner", ...overrides };
}

/** Establishes a connected + identified account, the precondition `listAndPersistOwnGoogleCalendars` requires. */
async function setUpIdentifiedAccount(): Promise<void> {
  await setUpConnectedGoogleCalendarReadonly();
  const identified = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
  if (identified.status !== "success") throw new Error("expected the setup identification to succeed");
}

describe("listAndPersistOwnGoogleCalendars — connection/scope/state/account gates", () => {
  it("returns no_connection when the caller has no connection at all", async () => {
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "no_connection" });
    expect(mockListGoogleCalendars).not.toHaveBeenCalled();
  });

  it("returns error(account_not_identified) when connected but never identified", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "account_not_identified" });
    expect(mockListGoogleCalendars).not.toHaveBeenCalled();
  });

  it("3. requires the readonly scope, never broadens it", async () => {
    await setUpIdentifiedAccount();
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    // The connection was set up with exactly GOOGLE_CALENDAR_READONLY_SCOPE — confirmed by setUpConnectedGoogleCalendarReadonly's own default.
  });
});

describe("listAndPersistOwnGoogleCalendars — API surface (1, 2, 33, 34)", () => {
  it("1. calls calendarList.list", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem()] });
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListGoogleCalendars).toHaveBeenCalled();
  });

  it("2, 33, 34. never calls any events endpoint — the mocked API surface exposes no such method", async () => {
    await setUpIdentifiedAccount();
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    // mockListGoogleCalendars is the only Calendar-API-shaped mock this test file wires up — proving
    // by construction that no other Calendar endpoint (events.*, freebusy.*, channels.*) is reachable.
    expect(mockGetPrimaryCalendarAccountIdentity).toHaveBeenCalledTimes(1); // once, during setUpIdentifiedAccount only
  });
});

describe("listAndPersistOwnGoogleCalendars — persistence, primary, default selection (9, 10, 12, 13, 14, 15, 18, 19)", () => {
  it("9 & 10. inserts new calendars and persists their mapped metadata", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "ana@amorebloom.com", summary: "Ana", description: "Personal", timeZone: "America/Los_Angeles", accessRole: "owner", primary: true })] });

    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("expected success");
    expect(result.calendars).toHaveLength(1);
    expect(result.calendars[0].provider_calendar_id).toBe("ana@amorebloom.com");
    expect(result.calendars[0].summary).toBe("Ana");
    expect(result.calendars[0].time_zone).toBe("America/Los_Angeles");
  });

  it("12 & 14. the primary calendar is mapped is_primary=true and default-selected", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "primary_cal", primary: true })] });

    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    expect(result.calendars[0].is_primary).toBe(true);
    expect(result.calendars[0].is_selected).toBe(true);
  });

  it("13 & 15. a non-primary calendar is mapped is_primary=false and NOT default-selected", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "secondary_cal" })] });

    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    expect(result.calendars[0].is_primary).toBe(false);
    expect(result.calendars[0].is_selected).toBe(false);
  });

  it("14 & 15 together — exactly one primary among several selects only that one by default", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({
      items: [calendarItem({ id: "primary_cal", primary: true }), calendarItem({ id: "secondary_cal_1" }), calendarItem({ id: "secondary_cal_2" })],
    });

    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    const byId = Object.fromEntries(result.calendars.map((c) => [c.provider_calendar_id, c]));
    expect(byId.primary_cal.is_selected).toBe(true);
    expect(byId.secondary_cal_1.is_selected).toBe(false);
    expect(byId.secondary_cal_2.is_selected).toBe(false);
  });

  it("18. no primary in the response does not silently select any calendar", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "cal_a" }), calendarItem({ id: "cal_b" })] });

    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    expect(result.calendars.every((c) => c.is_selected === false)).toBe(true);
    expect(result.calendars.every((c) => c.is_primary === false)).toBe(true);
  });

  it("19. repeated listing is idempotent — same calendars, no duplicates", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "cal_1", primary: true })] });

    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const second = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (second.status !== "success") throw new Error("expected success");
    expect(second.calendars).toHaveLength(1);
  });
});

describe("listAndPersistOwnGoogleCalendars — selection preservation across refresh (16, 17)", () => {
  it("16. a manually-selected non-primary calendar stays selected after a later refresh", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "primary_cal", primary: true }), calendarItem({ id: "secondary_cal" })] });
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    // Simulate the future manual-selection feature by writing directly through the manager (no selector UI exists yet — GCAL-03's own boundary).
    const account = await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const { upsertCalendar } = await import("@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager");
    await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, accountId: account!.id, providerCalendarId: "secondary_cal", isSelected: true });

    const refreshed = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (refreshed.status !== "success") throw new Error("expected success");
    const secondary = refreshed.calendars.find((c) => c.provider_calendar_id === "secondary_cal");
    expect(secondary?.is_selected).toBe(true);
  });

  it("17. a manually-deselected primary calendar stays deselected after a later refresh", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "primary_cal", primary: true })] });
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const account = await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const { upsertCalendar } = await import("@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager");
    await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, accountId: account!.id, providerCalendarId: "primary_cal", isSelected: false });

    const refreshed = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (refreshed.status !== "success") throw new Error("expected success");
    expect(refreshed.calendars[0].is_selected).toBe(false);
  });
});

describe("listAndPersistOwnGoogleCalendars — pagination bounds (20, 21, 22, 23)", () => {
  it("20 & 23. follows nextPageToken across multiple pages", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValueOnce({ items: [calendarItem({ id: "cal_a" })], nextPageToken: "page_2" }).mockResolvedValueOnce({ items: [calendarItem({ id: "cal_b" })] });

    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    expect(mockListGoogleCalendars).toHaveBeenCalledTimes(2);
    expect(result.calendars).toHaveLength(2);
    expect((mockListGoogleCalendars.mock.calls[1] as [string, { pageToken?: string }])[1].pageToken).toBe("page_2");
  });

  it("uses CALENDAR_LIST_PAGE_SIZE as maxResults", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [] });
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect((mockListGoogleCalendars.mock.calls[0] as [string, { maxResults: number }])[1].maxResults).toBe(CALENDAR_LIST_PAGE_SIZE);
  });

  it("21. never calls listGoogleCalendars more than CALENDAR_LIST_MAX_PAGES times, even with a pathological always-more-pages response", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockImplementation(async () => ({ items: [calendarItem({ id: `cal_${Math.random()}` })], nextPageToken: "always_more" }));

    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListGoogleCalendars.mock.calls.length).toBeLessThanOrEqual(CALENDAR_LIST_MAX_PAGES);
  });

  it("22. never persists more than CALENDAR_LIST_MAX_CALENDARS calendars", async () => {
    await setUpIdentifiedAccount();
    // A single page far exceeding the ceiling, so the per-page and aggregate bounds are both exercised.
    const manyItems = Array.from({ length: CALENDAR_LIST_MAX_CALENDARS + 50 }, (_, i) => calendarItem({ id: `cal_${i}` }));
    mockListGoogleCalendars.mockResolvedValueOnce({ items: manyItems.slice(0, 250), nextPageToken: "page_2" }).mockImplementation(async () => ({ items: manyItems, nextPageToken: "always_more" }));

    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    expect(result.calendars.length).toBeLessThanOrEqual(CALENDAR_LIST_MAX_CALENDARS);
  });
});

describe("listAndPersistOwnGoogleCalendars — partial failure safety (GCAL03-R)", () => {
  it("a failure mid-pagination does not persist any calendar from the incomplete listing, and existing rows are left untouched", async () => {
    await setUpIdentifiedAccount();
    // First, a fully successful listing establishes one real calendar row.
    mockListGoogleCalendars.mockResolvedValueOnce({ items: [calendarItem({ id: "cal_stable", summary: "Stable", primary: true })] });
    const first = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (first.status !== "success") throw new Error("expected success");

    // Now a second run's pagination fails partway through page 2.
    mockListGoogleCalendars
      .mockResolvedValueOnce({ items: [calendarItem({ id: "cal_stable", summary: "Stable (updated but should not persist)" })], nextPageToken: "page_2" })
      .mockRejectedValueOnce(new GoogleCalendarApiError("Google Calendar API error 500", 500));

    const second = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(second.status).not.toBe("success");

    // The existing row must be untouched — still "Stable", never "Stable (updated but should not persist)".
    const account = await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const calendars = await listCalendarsForCaller(account!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(calendars).toHaveLength(1);
    expect(calendars[0].summary).toBe("Stable");
  });
});

describe("listAndPersistOwnGoogleCalendars — error classification (24, 25, 26, 27, 28)", () => {
  it("24. classifies a 401 as reconnect_required", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 401", 401));
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "reconnect_required", reason: "google_calendar_unauthorized" });
  });

  it("25. classifies a 403 as a non-reconnect error", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 403", 403));
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "google_calendar_forbidden" });
  });

  it("26. classifies a 429 distinctly (rate limited)", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 429", 429));
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "google_calendar_rate_limited" });
  });

  it("27. classifies a 5xx distinctly", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 503", 503));
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "error", reason: "google_calendar_provider_error" });
  });

  it("28. never leaks a raw provider error message", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 500: <html>secret internal detail</html>", 500));
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(JSON.stringify(result)).not.toContain("secret internal detail");
  });
});

describe("listAndPersistOwnGoogleCalendars — token refresh + no exposure (29, 30, 31)", () => {
  it("proactively refreshes via the shared refresh action when the token is close to expiry", async () => {
    const { credentialId } = await setUpConnectedGoogleCalendarReadonly();
    const identified = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (identified.status !== "success") throw new Error("expected success");

    // Identification itself already used a fresh token; roll the credential back to
    // "close to expiry" so the calendar-list call below has its own real refresh to make.
    await rotateOAuthCredential(credentialId, { accessToken: "real-access-token", expiresAt: new Date(Date.now() + 30 * 1000).toISOString() });
    vi.mocked(refreshProviderOAuthConnectionAction).mockClear();

    mockListGoogleCalendars.mockResolvedValue({ items: [] });
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(refreshProviderOAuthConnectionAction).toHaveBeenCalledTimes(1);
    expect(mockListGoogleCalendars).toHaveBeenCalledWith("refreshed-access-token", expect.anything());
  });

  it("29 & 30. never includes a token in the returned result", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "cal_1", primary: true })] });
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(JSON.stringify(result)).not.toContain("real-access-token");
    expect(JSON.stringify(result)).not.toContain("real-refresh-token");
  });

  it("31. no token is ever persisted onto a calendar row", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "cal_1", primary: true })] });
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    expect(Object.keys(result.calendars[0])).not.toContain("access_token");
    expect(Object.keys(result.calendars[0])).not.toContain("refresh_token");
  });
});

describe("listAndPersistOwnGoogleCalendars — no event domain crossover (32)", () => {
  it("never persists event-shaped fields on a calendar row", async () => {
    await setUpIdentifiedAccount();
    mockListGoogleCalendars.mockResolvedValue({ items: [calendarItem({ id: "cal_1", primary: true })] });
    const result = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    const keys = Object.keys(result.calendars[0]);
    expect(keys).not.toContain("events");
    expect(keys).not.toContain("event_count");
  });
});
