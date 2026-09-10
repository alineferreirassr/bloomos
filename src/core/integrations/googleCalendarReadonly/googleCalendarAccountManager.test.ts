import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { getProvider } from "@/core/integrations/providerRegistry";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { installProvider } from "@/core/integrations/integrationManager";
import { resetGoogleCalendarAccountStore } from "@/lib/data/core/integrations/googleCalendarReadonly/accountStore";
import { resetGoogleCalendarStore } from "@/lib/data/core/integrations/googleCalendarReadonly/calendarStore";
import { resetGoogleCalendarEventStore } from "@/lib/data/core/integrations/googleCalendarReadonly/calendarEventStore";
import {
  calendarExistsForAccount,
  getAccountForCaller,
  getEventForCaller,
  getOwnAccount,
  listActiveCalendarEventsForCaller,
  listCalendarsForCaller,
  listEventsForCalendar,
  updateCalendarSyncToken,
  upsertAccount,
  upsertCalendar,
  upsertCalendarEvent,
} from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";

registerBuiltinProviders();

const WORKSPACE_ID = "ws_1";
const OTHER_WORKSPACE_ID = "ws_other";
const MEMBER_1 = "user_1";
const MEMBER_2 = "user_2";

async function installGoogleCalendarReadonlyConnection(workspaceId: string, memberId: string): Promise<string> {
  const connection = await installProvider({ workspaceId, providerId: "google-calendar-readonly", installedBy: memberId, memberId });
  return connection.id;
}

beforeEach(() => {
  resetConnectionStore();
  resetGoogleCalendarAccountStore();
  resetGoogleCalendarStore();
  resetGoogleCalendarEventStore();
});

describe("google-calendar-readonly provider registration (GCAL-02)", () => {
  it("1 & 2. registers the exact new provider id", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider).toBeDefined();
    expect(provider?.id).toBe("google-calendar-readonly");
  });

  it("3. requests exactly the calendar.readonly scope", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider?.oauth?.defaultScopes).toEqual(["https://www.googleapis.com/auth/calendar.readonly"]);
  });

  it("4. does not request the broad calendar scope or any other Google scope", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider?.oauth?.defaultScopes).not.toContain("https://www.googleapis.com/auth/calendar");
    expect(provider?.oauth?.defaultScopes).toHaveLength(1);
  });

  it("uses the existing integrations.calendar permission — no new permission key", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider?.requiredPermission).toBe("integrations.calendar");
  });

  it("supports PKCE", () => {
    const provider = getProvider("google-calendar-readonly");
    expect(provider?.oauth?.supportsPkce).toBe(true);
  });

  it("35. the existing outbound google-calendar provider is completely unaffected", () => {
    const provider = getProvider("google-calendar");
    expect(provider?.id).toBe("google-calendar");
    expect(provider?.requiredPermission).toBe("integrations.calendar");
    expect(provider?.oauth?.defaultScopes).toEqual(["https://www.googleapis.com/auth/calendar"]);
    expect(provider?.subscribedWebhookEvents).toEqual(["event.created"]);
    expect(provider?.description).toContain("Sync Event schedules to an external Google Calendar");
  });
});

describe("upsertAccount", () => {
  async function seedConnection(): Promise<string> {
    return installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
  }

  it("creates an account bound to the caller's own connection", async () => {
    const connectionId = await seedConnection();
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(account.workspace_id).toBe(WORKSPACE_ID);
    expect(account.member_id).toBe(MEMBER_1);
    expect(account.integration_connection_id).toBe(connectionId);
    expect(account.sync_status).toBe("not_synced");
  });

  it("15 & 20. supports null provider_account_id/email until identified, and persists the minimum identity fields once supplied", async () => {
    const connectionId = await seedConnection();
    const created = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    expect(created.provider_account_id).toBeNull();
    expect(created.provider_account_email).toBeNull();

    const identified = await upsertAccount({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      integrationConnectionId: connectionId,
      providerAccountId: "ana@amorebloom.com",
      providerAccountEmail: "ana@amorebloom.com",
      syncStatus: "synced",
    });
    expect(identified.id).toBe(created.id);
    expect(identified.provider_account_id).toBe("ana@amorebloom.com");
    expect(identified.provider_account_email).toBe("ana@amorebloom.com");
    expect(identified.sync_status).toBe("synced");
  });

  it("is idempotent — a second upsert for the same connection updates rather than duplicating", async () => {
    const connectionId = await seedConnection();
    const first = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId, syncStatus: "syncing" });
    const second = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId, syncStatus: "synced" });

    expect(second.id).toBe(first.id);
    expect(second.sync_status).toBe("synced");
  });

  it("34. never persists a sync_token, calendar list, or event content field — the schema has none", async () => {
    const connectionId = await seedConnection();
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const keys = Object.keys(account);
    expect(keys).not.toContain("sync_token");
    expect(keys).not.toContain("calendars");
    expect(keys).not.toContain("events");
    expect(keys).not.toContain("event_count");
  });

  it("rejects (forged account ownership) when the caller's workspaceId/memberId don't match the connection's own ownership", async () => {
    const connectionId = await seedConnection();
    await expect(upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, integrationConnectionId: connectionId })).rejects.toThrow(/not owned by the caller/);
    await expect(upsertAccount({ workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId })).rejects.toThrow();
  });

  it("rejects binding to a connection that isn't a google-calendar-readonly connection (e.g. the existing outbound google-calendar provider)", async () => {
    const connection = await installProvider({ workspaceId: WORKSPACE_ID, providerId: "google-calendar", installedBy: MEMBER_1 });
    await expect(upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connection.id })).rejects.toThrow(/not a Google Calendar \(read-only\) connection/);
  });

  it("17 & 18. rejects an unknown connection id (foreign account / foreign connection denial)", async () => {
    await expect(upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: "connection_missing" })).rejects.toThrow(/No integration connection/);
  });
});

describe("getAccountForCaller / getOwnAccount — ownership isolation (12, 13, 14, 16)", () => {
  it("12 & 16. the owning member can read their own account", async () => {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    const own = await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(own?.id).toBe(account.id);
  });

  it("13. denies a same-workspace, different member from reading the account", async () => {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(await getAccountForCaller(account.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).toBeNull();
    expect(await getOwnAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).toBeNull();
  });

  it("14. denies a cross-workspace caller from reading the account", async () => {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });

    expect(await getAccountForCaller(account.id, { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 })).toBeNull();
  });
});

describe("upsertCalendar (GCAL-03)", () => {
  async function seedAccount(): Promise<string> {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    return account.id;
  }

  it("9. inserts a new calendar bound to the caller's own account", async () => {
    const accountId = await seedAccount();
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "ana@amorebloom.com", summary: "Ana", isPrimary: true, isSelected: true });

    expect(calendar.account_id).toBe(accountId);
    expect(calendar.provider_calendar_id).toBe("ana@amorebloom.com");
    expect(calendar.summary).toBe("Ana");
    expect(calendar.is_primary).toBe(true);
    expect(calendar.is_selected).toBe(true);
    expect(calendar.sync_token).toBeNull();
  });

  it("10. updates metadata on an existing calendar (same account/provider id)", async () => {
    const accountId = await seedAccount();
    const first = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "ana@amorebloom.com", summary: "Ana", isPrimary: true, isSelected: true });
    const second = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "ana@amorebloom.com", summary: "Ana Ferreira", timeZone: "America/Los_Angeles" });

    expect(second.id).toBe(first.id);
    expect(second.summary).toBe("Ana Ferreira");
    expect(second.time_zone).toBe("America/Los_Angeles");
  });

  it("11. is unique per (account_id, provider_calendar_id) — a second upsert with the same provider id updates in place, never duplicates", async () => {
    const accountId = await seedAccount();
    await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_1", isSelected: false });
    await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_1", isSelected: false });

    const calendars = await listCalendarsForCaller(accountId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(calendars).toHaveLength(1);
  });

  it("provider_calendar_id stays a distinct field from the internal uuid id", async () => {
    const accountId = await seedAccount();
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "ana@amorebloom.com" });
    expect(calendar.id).not.toBe("ana@amorebloom.com");
    expect(calendar.provider_calendar_id).toBe("ana@amorebloom.com");
  });

  it("12. primary === true maps to is_primary true", async () => {
    const accountId = await seedAccount();
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_1", isPrimary: true });
    expect(calendar.is_primary).toBe(true);
  });

  it("13. a calendar without primary maps to is_primary false", async () => {
    const accountId = await seedAccount();
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_2" });
    expect(calendar.is_primary).toBe(false);
  });

  it("14. a new primary calendar defaults to selected when the caller explicitly passes isSelected", async () => {
    const accountId = await seedAccount();
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "primary_cal", isPrimary: true, isSelected: true });
    expect(calendar.is_selected).toBe(true);
  });

  it("15. a new non-primary calendar defaults to not-selected when omitted", async () => {
    const accountId = await seedAccount();
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "secondary_cal" });
    expect(calendar.is_selected).toBe(false);
  });

  it("16 & 17. omitting isSelected on an update preserves the existing row's own selection, in both directions", async () => {
    const accountId = await seedAccount();
    const selected = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_a", isSelected: true });
    const notSelected = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_b", isSelected: false });

    // Simulate a later manual user change (not modeled by a UI yet, but the persisted state a future selector would produce).
    // Then simulate a refresh that omits isSelected entirely, as the service always does for an existing row.
    const refreshedSelected = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_a", summary: "Updated" });
    const refreshedNotSelected = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_b", summary: "Updated" });

    expect(refreshedSelected.id).toBe(selected.id);
    expect(refreshedSelected.is_selected).toBe(true);
    expect(refreshedNotSelected.id).toBe(notSelected.id);
    expect(refreshedNotSelected.is_selected).toBe(false);
  });

  it("rejects (forged account ownership) when the caller's workspaceId/memberId don't match the account's own ownership", async () => {
    const accountId = await seedAccount();
    await expect(upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, accountId, providerCalendarId: "cal_1" })).rejects.toThrow(/not owned by the caller/);
  });

  it("17. rejects an unknown account id (foreign account denial)", async () => {
    await expect(upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId: "account_missing", providerCalendarId: "cal_1" })).rejects.toThrow(/No Google Calendar account/);
  });
});

describe("updateCalendarSyncToken (GCAL-05)", () => {
  async function seedCalendar(memberId: string = MEMBER_1): Promise<string> {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, memberId);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId, integrationConnectionId: connectionId });
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId, accountId: account.id, providerCalendarId: "cal_1" });
    return calendar.id;
  }

  it("sets sync_token on the caller's own calendar", async () => {
    const calendarId = await seedCalendar();
    const updated = await updateCalendarSyncToken(calendarId, "sync_abc123", { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(updated.sync_token).toBe("sync_abc123");
  });

  it("clears sync_token back to null (410 recovery's own use)", async () => {
    const calendarId = await seedCalendar();
    await updateCalendarSyncToken(calendarId, "sync_abc123", { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    const cleared = await updateCalendarSyncToken(calendarId, null, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(cleared.sync_token).toBeNull();
  });

  it("never touches any other field on the calendar row", async () => {
    const calendarId = await seedCalendar();
    const updated = await updateCalendarSyncToken(calendarId, "sync_abc123", { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(updated.provider_calendar_id).toBe("cal_1");
    expect(updated.is_selected).toBe(false);
    expect(updated.is_primary).toBe(false);
  });

  it("GCAL05-AL:48. denies a same-workspace, different member from updating another member's calendar sync token", async () => {
    const calendarId = await seedCalendar(MEMBER_1);
    await expect(updateCalendarSyncToken(calendarId, "sync_abc123", { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).rejects.toThrow(/not owned by the caller/);
  });

  it("GCAL05-AL:49. denies a cross-workspace caller from updating a calendar's sync token", async () => {
    const calendarId = await seedCalendar(MEMBER_1);
    await expect(updateCalendarSyncToken(calendarId, "sync_abc123", { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 })).rejects.toThrow(/not owned by the caller/);
  });

  it("GCAL05-AL:50. rejects an unknown/foreign calendar id — no client-supplied id can bypass ownership", async () => {
    await expect(updateCalendarSyncToken("calendar_missing", "sync_abc123", { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 })).rejects.toThrow(/No Google Calendar found/);
  });
});

describe("listCalendarsForCaller / calendarExistsForAccount — ownership isolation", () => {
  async function seedAccount(memberId: string = MEMBER_1): Promise<string> {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, memberId);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId, integrationConnectionId: connectionId });
    return account.id;
  }

  it("5. the owning member can list their own account's calendars", async () => {
    const accountId = await seedAccount();
    await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_1" });

    const calendars = await listCalendarsForCaller(accountId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(calendars).toHaveLength(1);
  });

  it("6. denies a same-workspace, different member from listing another member's calendars", async () => {
    const accountId = await seedAccount();
    await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_1" });

    await expect(listCalendarsForCaller(accountId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).rejects.toThrow();
  });

  it("7. denies a cross-workspace caller from listing calendars", async () => {
    const accountId = await seedAccount();
    await expect(listCalendarsForCaller(accountId, { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 })).rejects.toThrow();
  });

  it("8. denies a foreign account id from being probed via calendarExistsForAccount", async () => {
    await expect(calendarExistsForAccount("account_missing", "cal_1", { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 })).rejects.toThrow(/No Google Calendar account/);
  });

  it("calendarExistsForAccount correctly reports existence without leaking calendar content", async () => {
    const accountId = await seedAccount();
    expect(await calendarExistsForAccount(accountId, "cal_1", { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 })).toBe(false);
    await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "cal_1" });
    expect(await calendarExistsForAccount(accountId, "cal_1", { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 })).toBe(true);
  });
});

describe("upsertCalendarEvent (GCAL-04)", () => {
  async function seedCalendar(): Promise<string> {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, MEMBER_1);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connectionId });
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId: account.id, providerCalendarId: "primary_cal", isPrimary: true, isSelected: true });
    return calendar.id;
  }

  it("24. inserts a new active timed event", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      calendarId,
      providerEventId: "evt_1",
      summary: "Consult",
      status: "confirmed",
      allDay: false,
      startDateTime: "2026-01-05T10:00:00-08:00",
      endDateTime: "2026-01-05T11:00:00-08:00",
      timeZone: "America/Los_Angeles",
    });

    expect(event.calendar_id).toBe(calendarId);
    expect(event.provider_event_id).toBe("evt_1");
    expect(event.summary).toBe("Consult");
    expect(event.all_day).toBe(false);
    expect(event.start_date_time).toBe("2026-01-05T10:00:00-08:00");
    expect(event.cancelled_at).toBeNull();
  });

  it("25. updates metadata on an existing event (same calendar/provider id)", async () => {
    const calendarId = await seedCalendar();
    const first = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", summary: "Consult", allDay: false });
    const second = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", summary: "Consult (moved)", allDay: false });

    expect(second.id).toBe(first.id);
    expect(second.summary).toBe("Consult (moved)");
  });

  it("26. is unique per (calendar_id, provider_event_id) — a second upsert with the same provider id updates in place, never duplicates", async () => {
    const calendarId = await seedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false });

    const events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(events).toHaveLength(1);
  });

  it("provider_event_id stays a distinct field from the internal uuid id", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false });
    expect(event.id).not.toBe("evt_1");
    expect(event.provider_event_id).toBe("evt_1");
  });

  it("16. all-day event: date fields populated, timestamp fields null", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: true, startDate: "2026-03-01", endDate: "2026-03-02" });
    expect(event.all_day).toBe(true);
    expect(event.start_date).toBe("2026-03-01");
    expect(event.end_date).toBe("2026-03-02");
    expect(event.start_date_time).toBeNull();
    expect(event.end_date_time).toBeNull();
  });

  it("18. multi-day all-day event preserves Google's own exclusive end date, unadjusted", async () => {
    const calendarId = await seedCalendar();
    // A 3-day all-day event (Mar 1, 2, 3) — Google's own end.date is exclusive, so it reports "2026-03-04", not "2026-03-03".
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_multi_day", allDay: true, startDate: "2026-03-01", endDate: "2026-03-04" });
    expect(event.end_date).toBe("2026-03-04");
  });

  it("17 & 19. timed event: timestamp fields populated, date fields null, timezone preserved", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      calendarId,
      providerEventId: "evt_1",
      allDay: false,
      startDateTime: "2026-01-05T10:00:00-08:00",
      endDateTime: "2026-01-05T11:00:00-08:00",
      timeZone: "America/Los_Angeles",
    });
    expect(event.start_date).toBeNull();
    expect(event.end_date).toBeNull();
    expect(event.start_date_time).toBe("2026-01-05T10:00:00-08:00");
    expect(event.end_date_time).toBe("2026-01-05T11:00:00-08:00");
    expect(event.time_zone).toBe("America/Los_Angeles");
  });

  it("20, 21, 22, 23. persists provider_event_id, iCalUid, recurringEventId, originalStartTime", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      calendarId,
      providerEventId: "evt_occurrence_1",
      iCalUid: "series_1@google.com",
      recurringEventId: "series_1",
      originalStartTime: "2026-01-05T10:00:00-08:00",
      allDay: false,
    });
    expect(event.provider_event_id).toBe("evt_occurrence_1");
    expect(event.i_cal_uid).toBe("series_1@google.com");
    expect(event.recurring_event_id).toBe("series_1");
    expect(event.original_start_time).toBe("2026-01-05T10:00:00-08:00");
  });

  it("27. a cancelled event sets cancelled_at", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", status: "cancelled", allDay: false });
    expect(event.status).toBe("cancelled");
    expect(event.cancelled_at).not.toBeNull();
  });

  it("28. repeated cancellation is idempotent — cancelled_at is never overwritten on replay (first tombstone wins)", async () => {
    const calendarId = await seedCalendar();
    const first = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", status: "cancelled", allDay: false });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", status: "cancelled", allDay: false });

    expect(second.cancelled_at).toBe(first.cancelled_at);
  });

  it("29. resurrection — an event that becomes active again clears cancelled_at, without creating a duplicate row", async () => {
    const calendarId = await seedCalendar();
    const cancelled = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", status: "cancelled", allDay: false });
    expect(cancelled.cancelled_at).not.toBeNull();

    const resurrected = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", status: "confirmed", allDay: false });
    expect(resurrected.id).toBe(cancelled.id);
    expect(resurrected.cancelled_at).toBeNull();

    const events = await listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(events).toHaveLength(1);
  });

  it("does not persist a redundant is_deleted boolean — cancelled_at is the sole tombstone signal", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false });
    expect(Object.keys(event)).not.toContain("is_deleted");
  });

  it("rejects (forged calendar ownership) when the caller's workspaceId/memberId don't match the calendar's own ownership", async () => {
    const calendarId = await seedCalendar();
    await expect(upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_2, calendarId, providerEventId: "evt_1", allDay: false })).rejects.toThrow(/not owned by the caller/);
  });

  it("33. rejects an unknown calendar id (foreign calendar denial)", async () => {
    await expect(upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId: "calendar_missing", providerEventId: "evt_1", allDay: false })).rejects.toThrow(/No Google Calendar found/);
  });
});

describe("getEventForCaller / listEventsForCalendar — ownership isolation (30, 31, 32)", () => {
  async function seedCalendar(memberId: string = MEMBER_1): Promise<string> {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, memberId);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId, integrationConnectionId: connectionId });
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId, accountId: account.id, providerCalendarId: "primary_cal", isPrimary: true, isSelected: true });
    return calendar.id;
  }

  it("30. the owning member can read their own event", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false });

    const own = await getEventForCaller(event.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(own?.id).toBe(event.id);
  });

  it("31. denies a same-workspace, different member from reading the event", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false });

    expect(await getEventForCaller(event.id, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).toBeNull();
    await expect(listEventsForCalendar(calendarId, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 })).rejects.toThrow();
  });

  it("32. denies a cross-workspace caller from reading the event", async () => {
    const calendarId = await seedCalendar();
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false });

    expect(await getEventForCaller(event.id, { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 })).toBeNull();
    await expect(listEventsForCalendar(calendarId, { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 })).rejects.toThrow();
  });
});

describe("listActiveCalendarEventsForCaller (GCAL-06)", () => {
  const RANGE = { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T00:00:00.000Z" };

  async function seedSelectedCalendar(memberId: string = MEMBER_1, isSelected = true): Promise<{ accountId: string; calendarId: string }> {
    const connectionId = await installGoogleCalendarReadonlyConnection(WORKSPACE_ID, memberId);
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId, integrationConnectionId: connectionId });
    const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId, accountId: account.id, providerCalendarId: "primary_cal", isPrimary: true, isSelected });
    return { accountId: account.id, calendarId: calendar.id };
  }

  it("returns an empty array when the caller has no account at all", async () => {
    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result).toEqual([]);
  });

  it("returns an empty array when the caller has an account but no selected calendars", async () => {
    await seedSelectedCalendar(MEMBER_1, false);
    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result).toEqual([]);
  });

  it("only returns events from is_selected=true calendars, never an unselected one", async () => {
    const { accountId } = await seedSelectedCalendar(MEMBER_1, true);
    const unselected = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId, providerCalendarId: "secondary_cal", isSelected: false });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId: unselected.id, providerEventId: "evt_unselected", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result).toEqual([]);
  });

  it("excludes a cancelled event", async () => {
    const { calendarId } = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_cancelled", allDay: false, status: "cancelled", startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result).toEqual([]);
  });

  it("includes a timed event fully inside the range, and one spanning the range's start/end boundaries", async () => {
    const { calendarId } = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_inside", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_spans_start", allDay: false, startDateTime: "2026-07-31T23:00:00.000Z", endDateTime: "2026-08-01T01:00:00.000Z" });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_spans_end", allDay: false, startDateTime: "2026-08-30T23:00:00.000Z", endDateTime: "2026-08-31T01:00:00.000Z" });

    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result.map((e) => e.provider_event_id).sort()).toEqual(["evt_inside", "evt_spans_end", "evt_spans_start"]);
  });

  it("excludes a timed event fully outside the range", async () => {
    const { calendarId } = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_before", allDay: false, startDateTime: "2026-07-01T10:00:00.000Z", endDateTime: "2026-07-01T11:00:00.000Z" });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_after", allDay: false, startDateTime: "2026-09-15T10:00:00.000Z", endDateTime: "2026-09-15T11:00:00.000Z" });

    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result).toEqual([]);
  });

  it("includes a multi-day all-day event overlapping the range, using exclusive-end overlap semantics", async () => {
    const { calendarId } = await seedSelectedCalendar();
    // Exclusive end_date of 2026-08-01 means the event's last real day is 2026-07-31 — this still overlaps a range starting 2026-08-01T00:00:00.000Z? No: [2026-07-30, 2026-08-01) does NOT overlap [2026-08-01, 2026-08-31) since the exclusive end date equals the range's own inclusive start instant exactly — use a genuinely overlapping span instead.
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_multiday", allDay: true, startDate: "2026-07-30", endDate: "2026-08-02" });
    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result.map((e) => e.provider_event_id)).toEqual(["evt_multiday"]);
  });

  it("excludes an all-day event whose exclusive end_date lands exactly on the range's own start (no real overlap)", async () => {
    const { calendarId } = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_adjacent", allDay: true, startDate: "2026-07-29", endDate: "2026-08-01" });
    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result).toEqual([]);
  });

  it("a same-workspace, different member never sees another member's events — isolation, not merely denial", async () => {
    const { calendarId } = await seedSelectedCalendar(MEMBER_1);
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_member1", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: WORKSPACE_ID, memberId: MEMBER_2 });
    expect(result).toEqual([]);
  });

  it("a cross-workspace caller never sees another workspace's events", async () => {
    const { calendarId } = await seedSelectedCalendar(MEMBER_1);
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_member1", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const result = await listActiveCalendarEventsForCaller(RANGE, { workspaceId: OTHER_WORKSPACE_ID, memberId: MEMBER_1 });
    expect(result).toEqual([]);
  });
});
