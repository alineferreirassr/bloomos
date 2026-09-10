import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleCalendarApiError, getPrimaryCalendarAccountIdentity } from "@/core/integrations/googleCalendarReadonly/googleCalendarIdentity";

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

describe("getPrimaryCalendarAccountIdentity (GCAL-02)", () => {
  it("31. calls exactly GET /calendars/primary with the bearer token — no other Calendar API endpoint", async () => {
    const fetchMock = mockFetchOnce(200, { id: "ana@amorebloom.com", summary: "Ana", timeZone: "America/Los_Angeles" });

    await getPrimaryCalendarAccountIdentity("real-access-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://www.googleapis.com/calendar/v3/calendars/primary", { headers: { Authorization: "Bearer real-access-token" } });
  });

  it("19 & 20. returns the identified account id/email from Google's own primary-calendar id field, and both carry the same value", async () => {
    mockFetchOnce(200, { id: "ana@amorebloom.com", summary: "Ana", timeZone: "America/Los_Angeles" });

    const identity = await getPrimaryCalendarAccountIdentity("real-access-token");

    expect(identity.providerAccountId).toBe("ana@amorebloom.com");
    expect(identity.providerAccountEmail).toBe("ana@amorebloom.com");
    expect(identity.providerAccountId).toBe(identity.providerAccountEmail);
  });

  it("never requests a calendar list or events — only the one primary-calendar identification call", async () => {
    const fetchMock = mockFetchOnce(200, { id: "ana@amorebloom.com" });
    await getPrimaryCalendarAccountIdentity("real-access-token");

    const calledUrl = String((fetchMock.mock.calls[0] as [string, unknown])[0]);
    expect(calledUrl).not.toContain("/calendarList");
    expect(calledUrl).not.toContain("/events");
  });

  it("21. throws a GoogleCalendarApiError carrying status 401 on an unauthorized response", async () => {
    mockFetchOnce(401, { error: "invalid credentials" });
    await expect(getPrimaryCalendarAccountIdentity("stale-token")).rejects.toMatchObject({ status: 401 });
  });

  it("22. throws with status 403 on a forbidden response", async () => {
    mockFetchOnce(403, { error: "forbidden" });
    await expect(getPrimaryCalendarAccountIdentity("real-access-token")).rejects.toMatchObject({ status: 403 });
  });

  it("23. throws with status 429 on a rate-limited response", async () => {
    mockFetchOnce(429, { error: "rate limited" });
    await expect(getPrimaryCalendarAccountIdentity("real-access-token")).rejects.toMatchObject({ status: 429 });
  });

  it("24. throws with a 5xx status on a provider-error response", async () => {
    mockFetchOnce(503, { error: "unavailable" });
    await expect(getPrimaryCalendarAccountIdentity("real-access-token")).rejects.toMatchObject({ status: 503 });
  });

  it("30. never leaks the raw provider response body directly — the error message is truncated, not the full body verbatim without bound", async () => {
    const longBody = "x".repeat(5000);
    mockFetchOnce(500, longBody);
    try {
      await getPrimaryCalendarAccountIdentity("real-access-token");
      expect.fail("expected a GoogleCalendarApiError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(GoogleCalendarApiError);
      expect((error as Error).message.length).toBeLessThan(300);
    }
  });
});
