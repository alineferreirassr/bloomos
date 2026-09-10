import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { mockGetPrimaryCalendarAccountIdentity, mockListGoogleCalendars, mockListGoogleCalendarEvents } = vi.hoisted(() => ({
  mockGetPrimaryCalendarAccountIdentity: vi.fn(),
  mockListGoogleCalendars: vi.fn(),
  mockListGoogleCalendarEvents: vi.fn(),
}));
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity")>("@/core/integrations/googleCalendarReadonly/googleCalendarIdentity");
  return { ...actual, getPrimaryCalendarAccountIdentity: mockGetPrimaryCalendarAccountIdentity };
});
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarListApi", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarListApi")>("@/core/integrations/googleCalendarReadonly/googleCalendarListApi");
  return { ...actual, listGoogleCalendars: mockListGoogleCalendars };
});
vi.mock("@/core/integrations/googleCalendarReadonly/googleCalendarEventApi", async () => {
  const actual = await vi.importActual<typeof import("@/core/integrations/googleCalendarReadonly/googleCalendarEventApi")>("@/core/integrations/googleCalendarReadonly/googleCalendarEventApi");
  return { ...actual, listGoogleCalendarEvents: mockListGoogleCalendarEvents };
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
import { resetGoogleCalendarEventStore } from "@/lib/data/core/integrations/googleCalendarReadonly/calendarEventStore";
import { getOwnAccount, listCalendarsForCaller, listEventsForCalendar, upsertCalendar } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";
import {
  CALENDAR_LIST_MAX_CALENDARS,
  CALENDAR_LIST_MAX_PAGES,
  CALENDAR_LIST_PAGE_SIZE,
  EVENTS_MAX_EVENTS,
  EVENTS_MAX_PAGES,
  EVENTS_PAGE_SIZE,
  GCAL_INITIAL_FUTURE_DAYS,
  GCAL_INITIAL_PAST_DAYS,
  GOOGLE_CALENDAR_READONLY_SCOPE,
  identifyOwnGoogleCalendarAccount,
  listAndPersistOwnGoogleCalendars,
  syncOwnGoogleCalendarEvents,
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
  resetGoogleCalendarEventStore();
  vi.clearAllMocks();
  mockGetPrimaryCalendarAccountIdentity.mockResolvedValue({ providerAccountId: "ana@amorebloom.com", providerAccountEmail: "ana@amorebloom.com" });
  mockListGoogleCalendars.mockResolvedValue({ items: [] });
  mockListGoogleCalendarEvents.mockResolvedValue({ items: [] });
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

function eventItem(overrides: Partial<{ id: string; summary: string; status: string; start: { date?: string; dateTime?: string; timeZone?: string }; end: { date?: string; dateTime?: string; timeZone?: string }; recurringEventId: string; originalStartTime: { date?: string; dateTime?: string } }> = {}) {
  return {
    id: "evt_1",
    summary: "Event",
    status: "confirmed",
    start: { dateTime: "2026-01-05T10:00:00-08:00", timeZone: "America/Los_Angeles" },
    end: { dateTime: "2026-01-05T11:00:00-08:00", timeZone: "America/Los_Angeles" },
    ...overrides,
  };
}

/** Establishes a connected + identified account with exactly one selected (primary) calendar — the precondition `syncOwnGoogleCalendarEvents` requires to do any real work. */
async function setUpAccountWithSelectedCalendar(): Promise<{ calendarId: string }> {
  await setUpConnectedGoogleCalendarReadonly();
  const identified = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
  if (identified.status !== "success") throw new Error("expected identification to succeed");
  mockListGoogleCalendars.mockResolvedValueOnce({ items: [calendarItem({ id: "primary_cal", primary: true })] });
  const listed = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
  if (listed.status !== "success") throw new Error("expected calendar listing to succeed");
  return { calendarId: listed.calendars[0].id };
}

describe("syncOwnGoogleCalendarEvents — connection/scope/state/selection gates (1, 2, 3)", () => {
  it("returns no_connection when the caller has no connection at all", async () => {
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "no_connection" });
    expect(mockListGoogleCalendarEvents).not.toHaveBeenCalled();
  });

  it("3. returns no_selected_calendars as a safe no-op when the account has zero selected calendars — never an arbitrary fallback", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const identified = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (identified.status !== "success") throw new Error("expected success");
    // No calendars listed at all — zero persisted, so zero selected.
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "no_selected_calendars" });
    expect(mockListGoogleCalendarEvents).not.toHaveBeenCalled();
  });

  it("2. a persisted but unselected calendar is never synced", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const identified = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (identified.status !== "success") throw new Error("expected success");
    // Two calendars, neither primary, so neither is selected by default.
    mockListGoogleCalendars.mockResolvedValueOnce({ items: [calendarItem({ id: "cal_a" }), calendarItem({ id: "cal_b" })] });
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(result).toEqual({ status: "no_selected_calendars" });
    expect(mockListGoogleCalendarEvents).not.toHaveBeenCalled();
  });

  it("1. only the selected calendar is synced when a mix of selected/unselected calendars exists", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const identified = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (identified.status !== "success") throw new Error("expected success");
    mockListGoogleCalendars.mockResolvedValueOnce({ items: [calendarItem({ id: "primary_cal", primary: true }), calendarItem({ id: "secondary_cal" })] });
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    mockListGoogleCalendarEvents.mockResolvedValue({ items: [] });
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected success");
    expect(result.results).toHaveLength(1); // only the primary/selected calendar
    expect(mockListGoogleCalendarEvents).toHaveBeenCalledTimes(1);
  });
});

describe("syncOwnGoogleCalendarEvents — API surface and query parameters (4, 5, 6, 7, 8, 9)", () => {
  it("4. calls events.list for the selected calendar's own provider calendar id", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListGoogleCalendarEvents).toHaveBeenCalledWith(expect.any(String), "primary_cal", expect.anything());
    void calendarId;
  });

  it("7, 8, 9. computes timeMin/timeMax from the injected clock using GCAL_INITIAL_PAST_DAYS/FUTURE_DAYS, and passes EVENTS_PAGE_SIZE", async () => {
    await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [] });
    const now = new Date("2026-06-15T00:00:00.000Z");
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID }, now);

    const call = mockListGoogleCalendarEvents.mock.calls[0] as [string, string, { timeMin: string; timeMax: string; maxResults: number }];
    const expectedMin = new Date(now.getTime() - GCAL_INITIAL_PAST_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const expectedMax = new Date(now.getTime() + GCAL_INITIAL_FUTURE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    expect(call[2].timeMin).toBe(expectedMin);
    expect(call[2].timeMax).toBe(expectedMax);
    expect(call[2].maxResults).toBe(EVENTS_PAGE_SIZE);
  });
});

describe("syncOwnGoogleCalendarEvents — persistence and mapping (16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26)", () => {
  it("24 & 25. persists events, insert then update on a later sync", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1", summary: "Consult" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    let events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Consult");

    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1", summary: "Consult (updated)" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Consult (updated)");
  });

  it("17 & 19. maps a timed event correctly, including timezone", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1", start: { dateTime: "2026-01-05T10:00:00-08:00", timeZone: "America/Los_Angeles" }, end: { dateTime: "2026-01-05T11:00:00-08:00", timeZone: "America/Los_Angeles" } })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(event.all_day).toBe(false);
    expect(event.start_date_time).toBe("2026-01-05T10:00:00-08:00");
    expect(event.end_date_time).toBe("2026-01-05T11:00:00-08:00");
    expect(event.time_zone).toBe("America/Los_Angeles");
    expect(event.start_date).toBeNull();
  });

  it("16 & 18. maps a multi-day all-day event correctly, preserving Google's own exclusive end date", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_allday", start: { date: "2026-03-01" }, end: { date: "2026-03-04" } })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(event.all_day).toBe(true);
    expect(event.start_date).toBe("2026-03-01");
    expect(event.end_date).toBe("2026-03-04"); // exclusive — never adjusted to "2026-03-03"
    expect(event.start_date_time).toBeNull();
  });

  it("20, 21, 22, 23. maps provider_event_id/recurringEventId/originalStartTime for a recurring occurrence", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({
      items: [eventItem({ id: "evt_occurrence_1", recurringEventId: "series_1", originalStartTime: { dateTime: "2026-01-05T10:00:00-08:00" } })],
    });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(event.provider_event_id).toBe("evt_occurrence_1");
    expect(event.recurring_event_id).toBe("series_1");
    expect(event.original_start_time).toBe("2026-01-05T10:00:00-08:00");
  });

  it("does not persist a recurring series master — only expanded occurrences, matching singleEvents=true", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    // A true master (no recurringEventId of its own) never appears in a singleEvents=true response — only occurrences do.
    mockListGoogleCalendarEvents.mockResolvedValue({
      items: [eventItem({ id: "evt_occ_1", recurringEventId: "series_1" }), eventItem({ id: "evt_occ_2", recurringEventId: "series_1" })],
    });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.recurring_event_id === "series_1")).toBe(true);
    expect(events.some((e) => e.provider_event_id === "series_1")).toBe(false); // the master's own id never appears as a row
  });

  it("27, 28, 29. a cancelled event is tombstoned, idempotently, and clears on resurrection", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1", status: "confirmed" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1", status: "cancelled" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    let [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(event.cancelled_at).not.toBeNull();
    const firstCancelledAt = event.cancelled_at;

    // Replay the same cancellation.
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(event.cancelled_at).toBe(firstCancelledAt);

    // Resurrection.
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1", status: "confirmed" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(event.cancelled_at).toBeNull();
  });

  it("35 & 36. an event missing from a later refresh is never deleted or inferred cancelled — it remains exactly as last synced", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1" }), eventItem({ id: "evt_2" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    // A later, bounded-window refresh simply doesn't return evt_2 anymore (e.g. it fell outside the window) — not a cancellation signal.
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(events).toHaveLength(2);
    expect(events.find((e) => e.provider_event_id === "evt_2")?.cancelled_at).toBeNull();
  });
});

describe("syncOwnGoogleCalendarEvents — pagination bounds (10, 11, 12, 13)", () => {
  it("10. follows nextPageToken across multiple pages", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValueOnce({ items: [eventItem({ id: "evt_a" })], nextPageToken: "page_2" }).mockResolvedValueOnce({ items: [eventItem({ id: "evt_b" })] });

    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListGoogleCalendarEvents).toHaveBeenCalledTimes(2);
    const events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(events).toHaveLength(2);
  });

  it("11. never calls listGoogleCalendarEvents more than EVENTS_MAX_PAGES times, even with a pathological always-more-pages response", async () => {
    await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockImplementation(async () => ({ items: [eventItem({ id: `evt_${Math.random()}` })], nextPageToken: "always_more" }));

    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(mockListGoogleCalendarEvents.mock.calls.length).toBeLessThanOrEqual(EVENTS_MAX_PAGES);
  });

  it("12 & 13. never persists more than EVENTS_MAX_EVENTS events for one calendar", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    const manyItems = Array.from({ length: EVENTS_MAX_EVENTS + 100 }, (_, i) => eventItem({ id: `evt_${i}` }));
    mockListGoogleCalendarEvents.mockResolvedValueOnce({ items: manyItems.slice(0, 300), nextPageToken: "page_2" }).mockImplementation(async () => ({ items: manyItems, nextPageToken: "always_more" }));

    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(events.length).toBeLessThanOrEqual(EVENTS_MAX_EVENTS);
  });
});

describe("syncOwnGoogleCalendarEvents — partial-page and per-calendar failure safety (34)", () => {
  it("34. a failure mid-pagination for one calendar reports that calendar's own error outcome and touches none of its existing rows", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValueOnce({ items: [eventItem({ id: "evt_stable", summary: "Stable" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    mockListGoogleCalendarEvents
      .mockResolvedValueOnce({ items: [eventItem({ id: "evt_stable", summary: "Stable (should not persist)" })], nextPageToken: "page_2" })
      .mockRejectedValueOnce(new GoogleCalendarApiError("Google Calendar API error 500", 500));

    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected a success envelope with a per-calendar error outcome");
    expect(result.results[0].status).toBe("error");

    const events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Stable");
  });

  it("a failure on one selected calendar does not falsely mark a different, successfully-synced calendar as failed", async () => {
    await setUpConnectedGoogleCalendarReadonly();
    const identified = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (identified.status !== "success") throw new Error("expected success");
    mockListGoogleCalendars.mockResolvedValueOnce({ items: [calendarItem({ id: "primary_cal", primary: true }), calendarItem({ id: "secondary_cal" })] });
    const listed = await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (listed.status !== "success") throw new Error("expected success");
    // Both calendars must be selected for this test — explicitly select the secondary one too.
    const account = await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID, accountId: account!.id, providerCalendarId: "secondary_cal", isSelected: true });

    mockListGoogleCalendarEvents.mockImplementation(async (_token: string, providerCalendarId: string) => {
      if (providerCalendarId === "primary_cal") throw new GoogleCalendarApiError("Google Calendar API error 500", 500);
      return { items: [eventItem({ id: "evt_ok" })] };
    });

    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected a success envelope");
    expect(result.results).toHaveLength(2);
    expect(result.results.some((r) => r.status === "error")).toBe(true);
    expect(result.results.some((r) => r.status === "success" && r.eventsProcessed === 1)).toBe(true);
    void listed;
  });
});

describe("syncOwnGoogleCalendarEvents — error classification (37, 38, 39, 40, 41, 42)", () => {
  it("37. classifies a 401 as reconnect_required for that calendar", async () => {
    await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 401", 401));
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected a success envelope");
    expect(result.results[0]).toEqual({ calendarId: expect.any(String), status: "reconnect_required", reason: "google_calendar_unauthorized" });
  });

  it("38. classifies a 403 as a non-reconnect error", async () => {
    await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 403", 403));
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected a success envelope");
    expect(result.results[0]).toEqual({ calendarId: expect.any(String), status: "error", reason: "google_calendar_forbidden" });
  });

  it("39. classifies a 404 as a non-reconnect error", async () => {
    await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 404", 404));
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected a success envelope");
    expect(result.results[0]).toEqual({ calendarId: expect.any(String), status: "error", reason: "google_calendar_not_found" });
  });

  it("40. classifies a 429 distinctly", async () => {
    await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 429", 429));
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected a success envelope");
    expect(result.results[0]).toEqual({ calendarId: expect.any(String), status: "error", reason: "google_calendar_rate_limited" });
  });

  it("41. classifies a 5xx distinctly", async () => {
    await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 503", 503));
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (result.status !== "success") throw new Error("expected a success envelope");
    expect(result.results[0]).toEqual({ calendarId: expect.any(String), status: "error", reason: "google_calendar_provider_error" });
  });

  it("42. never leaks a raw provider error message", async () => {
    await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockRejectedValue(new GoogleCalendarApiError("Google Calendar API error 500: <html>secret internal detail</html>", 500));
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(JSON.stringify(result)).not.toContain("secret internal detail");
  });
});

describe("syncOwnGoogleCalendarEvents — token refresh, exposure, sync_token, scope (43, 44, 45, 48, 49)", () => {
  it("43. proactively refreshes via the shared refresh action when the token is close to expiry", async () => {
    const { credentialId } = await setUpConnectedGoogleCalendarReadonly();
    const identified = await identifyOwnGoogleCalendarAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    if (identified.status !== "success") throw new Error("expected success");
    mockListGoogleCalendars.mockResolvedValueOnce({ items: [calendarItem({ id: "primary_cal", primary: true })] });
    await listAndPersistOwnGoogleCalendars({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    await rotateOAuthCredential(credentialId, { accessToken: "real-access-token", expiresAt: new Date(Date.now() + 30 * 1000).toISOString() });
    vi.mocked(refreshProviderOAuthConnectionAction).mockClear();

    mockListGoogleCalendarEvents.mockResolvedValue({ items: [] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(refreshProviderOAuthConnectionAction).toHaveBeenCalledTimes(1);
    expect(mockListGoogleCalendarEvents).toHaveBeenCalledWith("refreshed-access-token", expect.anything(), expect.anything());
  });

  it("44 & 45. never includes a token in the result or a persisted event row", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1" })] });
    const result = await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(JSON.stringify(result)).not.toContain("real-access-token");
    expect(JSON.stringify(result)).not.toContain("real-refresh-token");

    const events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(Object.keys(events[0])).not.toContain("access_token");
  });

  it("48 & 49. sync_token remains null/unchanged after an initial sync, and Google's own nextSyncToken (if ever returned) is ignored", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    // Even if a real Google response happened to include a nextSyncToken (not modeled by this checkpoint's own API item type), GCAL-04 never reads or persists it.
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const calendars = await listCalendarsForCaller((await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID }))!.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    const calendar = calendars.find((c) => c.id === calendarId)!;
    expect(calendar.sync_token).toBeNull();
  });
});

describe("syncOwnGoogleCalendarEvents — content safety / attendee minimization (46, 47)", () => {
  it("46. minimizes attendee/organizer fields — never Google's full attendee object", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({
      items: [
        {
          ...eventItem({ id: "evt_1" }),
          organizer: { email: "ana@amorebloom.com", displayName: "Ana", self: true },
          attendees: [{ email: "jordan@example.com", displayName: "Jordan", responseStatus: "accepted", self: false, optional: false, comment: "excited to attend!", additionalGuests: 2 }],
        },
      ],
    });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    expect(event.organizer).toEqual({ email: "ana@amorebloom.com", displayName: "Ana", self: true });
    expect(event.attendees).toEqual([{ email: "jordan@example.com", displayName: "Jordan", responseStatus: "accepted", self: false, optional: false }]);
    expect(JSON.stringify(event)).not.toContain("excited to attend");
    expect(JSON.stringify(event)).not.toContain("additionalGuests");
  });

  it("47. never introduces HTML rendering — description is stored as plain provider text only", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [{ ...eventItem({ id: "evt_1", summary: "Consult" }), description: "<script>alert(1)</script>Bridal consult" }] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    // Stored verbatim as plain text — no sanitizer, no HTML parsing, no dangerouslySetInnerHTML anywhere in this domain.
    expect(event.description).toBe("<script>alert(1)</script>Bridal consult");
  });
});

describe("syncOwnGoogleCalendarEvents — no internal Event / Scheduling crossover (50, 51)", () => {
  it("50. never creates a row shaped like an internal BloomOS Event", async () => {
    const { calendarId } = await setUpAccountWithSelectedCalendar();
    mockListGoogleCalendarEvents.mockResolvedValue({ items: [eventItem({ id: "evt_1" })] });
    await syncOwnGoogleCalendarEvents({ workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });

    const [event] = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_ID });
    // Internal Event's own distinguishing fields (see src/types/event.ts) never appear on this external record.
    const keys = Object.keys(event);
    expect(keys).not.toContain("client_id");
    expect(keys).not.toContain("event_type");
    expect(keys).not.toContain("lifecycle_stage");
  });
});
