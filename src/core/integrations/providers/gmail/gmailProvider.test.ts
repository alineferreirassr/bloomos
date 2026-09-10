import { afterEach, describe, expect, it, vi } from "vitest";
import { GmailApiError, GmailProvider } from "@/core/integrations/providers/gmail/gmailProvider";

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

describe("GmailProvider — read surface (GMAIL-05)", () => {
  it("getProfile calls users/me/profile with the bearer token and returns the parsed profile", async () => {
    const fetchMock = mockFetchOnce(200, { emailAddress: "ana@amorebloom.com", historyId: "12345" });
    const provider = new GmailProvider("real-access-token");

    const profile = await provider.getProfile();

    expect(fetchMock).toHaveBeenCalledWith("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: "Bearer real-access-token" } });
    expect(profile.emailAddress).toBe("ana@amorebloom.com");
    expect(profile.historyId).toBe("12345");
  });

  it("listThreads sends maxResults and an optional pageToken as query params", async () => {
    const fetchMock = mockFetchOnce(200, { threads: [{ id: "thread_1" }], resultSizeEstimate: 1 });
    const provider = new GmailProvider("real-access-token");

    await provider.listThreads({ maxResults: 25, pageToken: "page_2" });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.pathname).toBe("/gmail/v1/users/me/threads");
    expect(calledUrl.searchParams.get("maxResults")).toBe("25");
    expect(calledUrl.searchParams.get("pageToken")).toBe("page_2");
  });

  it("listThreads omits pageToken when not supplied", async () => {
    const fetchMock = mockFetchOnce(200, { resultSizeEstimate: 0 });
    const provider = new GmailProvider("real-access-token");

    await provider.listThreads({ maxResults: 25 });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.searchParams.has("pageToken")).toBe(false);
  });

  it("getThread requests format=full for the given thread id", async () => {
    const fetchMock = mockFetchOnce(200, { id: "thread_1", messages: [] });
    const provider = new GmailProvider("real-access-token");

    await provider.getThread("thread_1");

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.pathname).toBe("/gmail/v1/users/me/threads/thread_1");
    expect(calledUrl.searchParams.get("format")).toBe("full");
  });

  it("throws a GmailApiError carrying the real HTTP status on a non-2xx response", async () => {
    mockFetchOnce(401, { error: { message: "invalid credentials" } });
    const provider = new GmailProvider("expired-token");

    await expect(provider.getProfile()).rejects.toMatchObject({ status: 401 });
    await expect(provider.getProfile()).rejects.toBeInstanceOf(GmailApiError);
  });

  it.each([401, 403, 429, 500, 503])("classifies a %d response with the exact status on the thrown error", async (status) => {
    mockFetchOnce(status, { error: "provider error" });
    const provider = new GmailProvider("token");
    await expect(provider.getProfile()).rejects.toMatchObject({ status });
  });

  it("never exposes the access token in any thrown error message", async () => {
    mockFetchOnce(401, { error: "unauthorized" });
    const provider = new GmailProvider("super-secret-access-token-value");
    await expect(provider.getProfile()).rejects.not.toThrow(/super-secret-access-token-value/);
  });

  it("listHistory sends startHistoryId, an optional pageToken, and an optional maxResults as query params", async () => {
    const fetchMock = mockFetchOnce(200, { history: [], historyId: "999" });
    const provider = new GmailProvider("real-access-token");

    await provider.listHistory({ startHistoryId: "100", pageToken: "page_2", maxResults: 100 });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.pathname).toBe("/gmail/v1/users/me/history");
    expect(calledUrl.searchParams.get("startHistoryId")).toBe("100");
    expect(calledUrl.searchParams.get("pageToken")).toBe("page_2");
    expect(calledUrl.searchParams.get("maxResults")).toBe("100");
  });

  it("listHistory omits pageToken/maxResults when not supplied", async () => {
    const fetchMock = mockFetchOnce(200, { history: [] });
    const provider = new GmailProvider("real-access-token");

    await provider.listHistory({ startHistoryId: "100" });

    const calledUrl = new URL((fetchMock.mock.calls[0] as [string, unknown])[0] as string);
    expect(calledUrl.searchParams.has("pageToken")).toBe(false);
    expect(calledUrl.searchParams.has("maxResults")).toBe(false);
  });

  it("listHistory throws a GmailApiError with status 404 for an invalid/too-old startHistoryId, distinguishable from other failures", async () => {
    mockFetchOnce(404, { error: { message: "Invalid startHistoryId" } });
    const provider = new GmailProvider("real-access-token");
    await expect(provider.listHistory({ startHistoryId: "1" })).rejects.toMatchObject({ status: 404 });
  });
});
