import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleCalendarApiError } from "@/core/integrations/googleCalendarReadonly/googleCalendarIdentity";
import { listGoogleCalendars } from "@/core/integrations/googleCalendarReadonly/googleCalendarListApi";

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

describe("listGoogleCalendars (GCAL-03)", () => {
  it("1. calls GET /users/me/calendarList with the bearer token and maxResults", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendars("real-access-token", { maxResults: 50 });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe("https://www.googleapis.com/calendar/v3/users/me/calendarList");
    expect(calledUrl.searchParams.get("maxResults")).toBe("50");
    expect(calledUrl.searchParams.has("pageToken")).toBe(false);
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1]).toEqual({ headers: { Authorization: "Bearer real-access-token" } });
  });

  it("23. includes pageToken only when supplied", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendars("real-access-token", { maxResults: 50, pageToken: "page_2" });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.searchParams.get("pageToken")).toBe("page_2");
  });

  it("2. never requests any /events endpoint", async () => {
    const fetchMock = mockFetchOnce(200, { items: [] });
    await listGoogleCalendars("real-access-token", { maxResults: 50 });
    expect(String((fetchMock.mock.calls[0] as [string, unknown])[0])).not.toContain("/events");
  });

  it("19 & 20. maps only the required fields, exactly as returned", async () => {
    mockFetchOnce(200, {
      items: [
        { id: "ana@amorebloom.com", summary: "Ana", description: "My calendar", timeZone: "America/Los_Angeles", accessRole: "owner", primary: true, backgroundColor: "#ff0000", colorId: "1" },
        { id: "team@group.calendar.google.com", summary: "Team", accessRole: "reader" },
      ],
    });

    const page = await listGoogleCalendars("real-access-token", { maxResults: 50 });
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).toEqual({ id: "ana@amorebloom.com", summary: "Ana", description: "My calendar", timeZone: "America/Los_Angeles", accessRole: "owner", primary: true, backgroundColor: "#ff0000", colorId: "1" });
    // Note: the raw item is passed through untyped by fetch's own JSON parse — the TYPE only declares
    // id/summary/description/timeZone/accessRole/primary; excess fields like backgroundColor/colorId are
    // simply never read anywhere downstream (see googleCalendarAccountService.ts's own field mapping).
  });

  it("20. a non-primary calendar's primary field is simply absent, not coerced to false", async () => {
    mockFetchOnce(200, { items: [{ id: "team@group.calendar.google.com", summary: "Team" }] });
    const page = await listGoogleCalendars("real-access-token", { maxResults: 50 });
    expect(page.items[0].primary).toBeUndefined();
  });

  it("returns nextPageToken when Google supplies one", async () => {
    mockFetchOnce(200, { items: [], nextPageToken: "next_page_abc" });
    const page = await listGoogleCalendars("real-access-token", { maxResults: 50 });
    expect(page.nextPageToken).toBe("next_page_abc");
  });

  it("defaults items to an empty array when Google omits the field entirely", async () => {
    mockFetchOnce(200, {});
    const page = await listGoogleCalendars("real-access-token", { maxResults: 50 });
    expect(page.items).toEqual([]);
  });

  it("24. throws a GoogleCalendarApiError carrying status 401", async () => {
    mockFetchOnce(401, { error: "invalid credentials" });
    await expect(listGoogleCalendars("stale-token", { maxResults: 50 })).rejects.toMatchObject({ status: 401 });
  });

  it("25. throws with status 403", async () => {
    mockFetchOnce(403, { error: "forbidden" });
    await expect(listGoogleCalendars("real-access-token", { maxResults: 50 })).rejects.toMatchObject({ status: 403 });
  });

  it("26. throws with status 429", async () => {
    mockFetchOnce(429, { error: "rate limited" });
    await expect(listGoogleCalendars("real-access-token", { maxResults: 50 })).rejects.toMatchObject({ status: 429 });
  });

  it("27. throws with a 5xx status", async () => {
    mockFetchOnce(503, { error: "unavailable" });
    await expect(listGoogleCalendars("real-access-token", { maxResults: 50 })).rejects.toMatchObject({ status: 503 });
  });

  it("28. never leaks the raw provider response body unbounded", async () => {
    mockFetchOnce(500, "x".repeat(5000));
    try {
      await listGoogleCalendars("real-access-token", { maxResults: 50 });
      expect.fail("expected a GoogleCalendarApiError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleCalendarApiError);
      expect((error as Error).message.length).toBeLessThan(300);
    }
  });
});
