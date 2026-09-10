import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { installProvider } from "@/core/integrations/integrationManager";
import { resetGoogleCalendarAccountStore } from "@/lib/data/core/integrations/googleCalendarReadonly/accountStore";
import { resetGoogleCalendarStore } from "@/lib/data/core/integrations/googleCalendarReadonly/calendarStore";
import { resetGoogleCalendarEventStore } from "@/lib/data/core/integrations/googleCalendarReadonly/calendarEventStore";
import { upsertAccount, upsertCalendar, upsertCalendarEvent } from "@/core/integrations/googleCalendarReadonly/googleCalendarAccountManager";
import { createGoogleCalendarEventSource } from "@/core/calendar/sources/googleCalendarEventCalendarSource";

registerBuiltinProviders();

const WORKSPACE_ID = "ws_1";
const OTHER_WORKSPACE_ID = "ws_other";
const MEMBER_1 = "user_1";
const MEMBER_2 = "user_2";

const RANGE = { start: new Date("2026-08-01T00:00:00.000Z"), end: new Date("2026-08-31T00:00:00.000Z") };

function fakeContext(memberId: string, permissions: string[] = ["integrations.calendar"]): ServerRepositoryContext {
  return {
    supabase: {} as ServerRepositoryContext["supabase"],
    session: {
      user: { id: memberId },
      permissions,
    },
  } as unknown as ServerRepositoryContext;
}

async function seedSelectedCalendar(memberId: string = MEMBER_1, isSelected = true): Promise<string> {
  const connection = await installProvider({ workspaceId: WORKSPACE_ID, providerId: "google-calendar-readonly", installedBy: memberId, memberId });
  const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId, integrationConnectionId: connection.id });
  const calendar = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId, accountId: account.id, providerCalendarId: "primary_cal", isPrimary: true, isSelected });
  return calendar.id;
}

beforeEach(() => {
  resetConnectionStore();
  resetGoogleCalendarAccountStore();
  resetGoogleCalendarStore();
  resetGoogleCalendarEventStore();
});

describe("createGoogleCalendarEventSource (GCAL-06)", () => {
  it("GCAL06-AK:1 & 19. registers with a distinct, Google-identifying sourceType", () => {
    const source = createGoogleCalendarEventSource();
    expect(source.sourceType).toBe("google_calendar_event");
    expect(source.sourceType).not.toBe("event");
    expect(source.sourceType).not.toBe("checklist_item");
  });

  it("GCAL06-AK:27 & 28. never calls the Google API or triggers a sync — pure DB read (no fetch/network mock is even wired up, so a real network call would throw)", async () => {
    await seedSelectedCalendar();
    const source = createGoogleCalendarEventSource();
    await expect(source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1))).resolves.toBeDefined();
  });

  it("GCAL06-AK:35. no Google connection at all → contributes zero events, not an error", async () => {
    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toEqual([]);
  });

  it("GCAL06-AK:38. no selected calendars → contributes zero events", async () => {
    await seedSelectedCalendar(MEMBER_1, false);
    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toEqual([]);
  });

  it("no session context at all (e.g. mock data mode) → contributes zero events, never throws", async () => {
    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, undefined);
    expect(result).toEqual([]);
  });

  it("GCAL06-AK:41. missing integrations.calendar permission → contributes zero events even with a connected, selected calendar", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1, []));
    expect(result).toEqual([]);
  });

  it("GCAL06-AK:2. an own selected-calendar event renders", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", summary: "Bridal Consult", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z", timeZone: "UTC" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Bridal Consult");
  });

  it("GCAL06-AK:3. an unselected calendar's event does not render", async () => {
    const connection = await installProvider({ workspaceId: WORKSPACE_ID, providerId: "google-calendar-readonly", installedBy: MEMBER_1, memberId: MEMBER_1 });
    const account = await upsertAccount({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, integrationConnectionId: connection.id });
    const unselected = await upsertCalendar({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, accountId: account.id, providerCalendarId: "secondary_cal", isSelected: false });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId: unselected.id, providerEventId: "evt_1", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toEqual([]);
  });

  it("GCAL06-AK:4. a cancelled event does not render", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false, status: "cancelled", startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toEqual([]);
  });

  it("GCAL06-AK:5. a same-workspace, different member's event is denied", async () => {
    const calendarId = await seedSelectedCalendar(MEMBER_1);
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_2));
    expect(result).toEqual([]);
  });

  it("GCAL06-AK:6. a cross-workspace event is denied", async () => {
    const calendarId = await seedSelectedCalendar(MEMBER_1);
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, OTHER_WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toEqual([]);
  });

  it("GCAL06-AK:8, 9, 12. range query is bounded — an in-range timed event is included, an out-of-range one is not", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_inside", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_outside", allDay: false, startDateTime: "2026-09-15T10:00:00.000Z", endDateTime: "2026-09-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toHaveLength(1);
  });

  it("GCAL06-AK:10 & 11. a timed event spanning the range's start or end boundary is included", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_spans_start", allDay: false, startDateTime: "2026-07-31T23:00:00.000Z", endDateTime: "2026-08-01T01:00:00.000Z" });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_spans_end", allDay: false, startDateTime: "2026-08-30T23:00:00.000Z", endDateTime: "2026-08-31T01:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toHaveLength(2);
  });

  it("GCAL06-AK:13 & 14. a multi-day all-day event overlapping the range is included", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_multiday", allDay: true, startDate: "2026-08-14", endDate: "2026-08-17" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toHaveLength(1);
    expect(result[0].allDay).toBe(true);
  });

  it("GCAL06-AK:15. all-day exclusive-end behavior: a 3-day event (exclusive end_date the 4th day) maps to an inclusive end on its own last real day, never the exclusive boundary day", async () => {
    const calendarId = await seedSelectedCalendar();
    // Google's own exclusive convention: start_date=2026-08-01, end_date=2026-08-04 means the event covers Aug 1, 2, 3 — never Aug 4.
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: true, startDate: "2026-08-01", endDate: "2026-08-04" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result[0].start).toBe("2026-08-01T00:00:00");
    expect(result[0].end).toBe("2026-08-03T23:59:00"); // Aug 3, not Aug 4 — the exclusive boundary is never surfaced as if it were an inclusive day
  });

  it("a single-day all-day event (exclusive end_date the next day) maps start and end to the same calendar day", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: true, startDate: "2026-08-05", endDate: "2026-08-06" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result[0].start).toBe("2026-08-05T00:00:00");
    expect(result[0].end).toBe("2026-08-05T23:59:00");
  });

  it("GCAL06-AK:16 & 17. summary maps to title, and a null/empty summary falls back to a safe neutral title", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_named", summary: "Cake Tasting", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_unnamed", summary: null, allDay: false, startDateTime: "2026-08-16T10:00:00.000Z", endDateTime: "2026-08-16T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    const byTitle = result.map((e) => e.title).sort();
    expect(byTitle).toEqual(["Cake Tasting", "Untitled event"]);
  });

  it("GCAL06-AK:18. timezone is preserved on the mapped CalendarEvent", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false, startDateTime: "2026-08-15T18:00:00.000Z", endDateTime: "2026-08-15T19:00:00.000Z", timeZone: "America/Los_Angeles" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result[0].timezone).toBe("America/Los_Angeles");
    // 18:00 UTC on 2026-08-15 is 11:00 in America/Los_Angeles (PDT, UTC-7) — proves the mapper actually converts by zone, not a naive UTC slice.
    expect(result[0].start).toBe("2026-08-15T11:00:00");
  });

  it("GCAL06-AK:20 & 21. sourceId/id use the internal record id, never the raw provider_event_id, as the primary client identity", async () => {
    const calendarId = await seedSelectedCalendar();
    const event = await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "raw_google_provider_event_id_12345", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result[0].sourceId).toBe(event.id);
    expect(result[0].sourceId).not.toBe("raw_google_provider_event_id_12345");
    expect(result[0].id).toBe(`google_calendar_event:${event.id}`);
  });

  it("GCAL06-AK:22. sync_token never appears anywhere in the mapped result", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(JSON.stringify(result)).not.toMatch(/sync_token|syncToken/i);
  });

  it("GCAL06-AK:23 & 24. a malicious-looking summary/description-shaped string is never rendered as HTML — stored and returned as plain text only", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", summary: "<script>alert(1)</script>Consult", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result[0].title).toBe("<script>alert(1)</script>Consult"); // exact plain text, never parsed/stripped as HTML
  });

  it("GCAL06-AK:25 & 26. attendees and organizer are never present on the mapped CalendarEvent — no such fields exist on the type, and none are added", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({
      workspaceId: WORKSPACE_ID,
      memberId: MEMBER_1,
      calendarId,
      providerEventId: "evt_1",
      allDay: false,
      startDateTime: "2026-08-15T10:00:00.000Z",
      endDateTime: "2026-08-15T11:00:00.000Z",
      organizer: { email: "ana@amorebloom.com", displayName: "Ana", self: true },
      attendees: [{ email: "jordan@example.com", displayName: "Jordan", responseStatus: "accepted", self: false, optional: false }],
    });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(Object.keys(result[0])).not.toContain("attendees");
    expect(Object.keys(result[0])).not.toContain("organizer");
    expect(JSON.stringify(result)).not.toContain("jordan@example.com");
    expect(JSON.stringify(result)).not.toContain("ana@amorebloom.com");
  });

  it("does not surface an href — a Google event renders as the same non-interactive row every view already uses for a source item with no href", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_1", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result[0].href).toBeUndefined();
  });

  it("GCAL06-AK:39. a defensively-malformed event (no start/end at all, possible per GCAL-04's own mapper fallback) is silently excluded rather than breaking the whole source", async () => {
    const calendarId = await seedSelectedCalendar();
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_good", allDay: false, startDateTime: "2026-08-15T10:00:00.000Z", endDateTime: "2026-08-15T11:00:00.000Z" });
    await upsertCalendarEvent({ workspaceId: WORKSPACE_ID, memberId: MEMBER_1, calendarId, providerEventId: "evt_malformed", allDay: false });

    const source = createGoogleCalendarEventSource();
    const result = await source.fetch(RANGE, WORKSPACE_ID, fakeContext(MEMBER_1));
    expect(result).toHaveLength(1);
    expect(result[0].sourceId).not.toBe("evt_malformed");
  });
});
