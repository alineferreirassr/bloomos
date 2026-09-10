import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleCalendarApiError } from "@/core/integrations/googleCalendarReadonly/googleCalendarIdentity";
import { listGoogleCalendarEvents } from "@/core/integrations/googleCalendarReadonly/googleCalendarEventApi";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

function mockFetchOnce(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("listGoogleCalendarEvents (GCAL-04)", () => {
  it("4. calls GET /calendars/{calendarId}/events with the bearer token", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendarEvents("real-access-token", "ana@amorebloom.com", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe("https://www.googleapis.com/calendar/v3/calendars/ana%40amorebloom.com/events");
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1]).toEqual({ headers: { Authorization: "Bearer real-access-token" } });
  });

  it("URL-encodes the calendar id safely", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendarEvents("real-access-token", "team@group.calendar.google.com", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
    const calledUrl = String((fetchMock.mock.calls[0] as [string, unknown])[0]);
    expect(calledUrl).toContain(encodeURIComponent("team@group.calendar.google.com"));
  });

  it("5. always sends singleEvents=true", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.searchParams.get("singleEvents")).toBe("true");
  });

  it("6. always sends showDeleted=true", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.searchParams.get("showDeleted")).toBe("true");
  });

  it("7 & 8. sends timeMin and timeMax exactly as given", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00.000Z", timeMax: "2026-04-01T00:00:00.000Z", maxResults: 250 });
    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.searchParams.get("timeMin")).toBe("2026-01-01T00:00:00.000Z");
    expect(calledUrl.searchParams.get("timeMax")).toBe("2026-04-01T00:00:00.000Z");
  });

  it("9. sends the given maxResults", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.searchParams.get("maxResults")).toBe("250");
  });

  it("includes pageToken only when supplied", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250, pageToken: "page_2" });
    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.searchParams.get("pageToken")).toBe("page_2");
  });

  it("14 & 15. never requests events.get, or any write endpoint — GET is the only method used", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
    const init = (fetchMock.mock.calls[0] as [string, RequestInit])[1];
    expect(init.method).toBeUndefined(); // fetch defaults to GET when method is omitted
    expect(Object.keys(init)).not.toContain("body");
  });

  it("maps the raw item fields through untouched", async () => {
    mockFetchOnce(200, {
      items: [
        {
          id: "evt_1",
          iCalUID: "evt_1@google.com",
          recurringEventId: "series_1",
          originalStartTime: { dateTime: "2026-01-05T10:00:00-08:00", timeZone: "America/Los_Angeles" },
          summary: "Consult",
          description: "Bridal consult",
          location: "Studio",
          status: "confirmed",
          start: { dateTime: "2026-01-05T10:00:00-08:00", timeZone: "America/Los_Angeles" },
          end: { dateTime: "2026-01-05T11:00:00-08:00", timeZone: "America/Los_Angeles" },
          organizer: { email: "ana@amorebloom.com", displayName: "Ana", self: true },
          attendees: [{ email: "jordan@example.com", displayName: "Jordan", responseStatus: "accepted", self: false, optional: false }],
          htmlLink: "https://calendar.google.com/event?eid=abc",
          hangoutLink: "https://meet.google.com/abc-defg-hij",
        },
      ],
    });
    const page = await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].id).toBe("evt_1");
    expect(page.items[0].recurringEventId).toBe("series_1");
    expect(page.items[0].organizer?.email).toBe("ana@amorebloom.com");
    expect(page.items[0].attendees?.[0]?.responseStatus).toBe("accepted");
  });

  it("returns nextPageToken when Google supplies one", async () => {
    mockFetchOnce(200, { items: [], nextPageToken: "next_page_abc" });
    const page = await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
    expect(page.nextPageToken).toBe("next_page_abc");
  });

  it("defaults items to an empty array when Google omits the field entirely", async () => {
    mockFetchOnce(200, {});
    const page = await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
    expect(page.items).toEqual([]);
  });

  it("37. throws a GoogleCalendarApiError carrying status 401", async () => {
    mockFetchOnce(401, { error: "invalid credentials" });
    await expect(listGoogleCalendarEvents("stale-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 })).rejects.toMatchObject({ status: 401 });
  });

  it("38. throws with status 403", async () => {
    mockFetchOnce(403, { error: "forbidden" });
    await expect(listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 })).rejects.toMatchObject({ status: 403 });
  });

  it("39. throws with status 404", async () => {
    mockFetchOnce(404, { error: "not found" });
    await expect(listGoogleCalendarEvents("real-access-token", "cal_missing", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 })).rejects.toMatchObject({ status: 404 });
  });

  it("40. throws with status 429", async () => {
    mockFetchOnce(429, { error: "rate limited" });
    await expect(listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 })).rejects.toMatchObject({ status: 429 });
  });

  it("41. throws with a 5xx status", async () => {
    mockFetchOnce(503, { error: "unavailable" });
    await expect(listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 })).rejects.toMatchObject({ status: 503 });
  });

  it("42. never leaks the raw provider response body unbounded", async () => {
    mockFetchOnce(500, "x".repeat(5000));
    try {
      await listGoogleCalendarEvents("real-access-token", "cal_1", { timeMin: "2026-01-01T00:00:00Z", timeMax: "2026-04-01T00:00:00Z", maxResults: 250 });
      expect.fail("expected a GoogleCalendarApiError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleCalendarApiError);
      expect((error as Error).message.length).toBeLessThan(300);
    }
  });
});
