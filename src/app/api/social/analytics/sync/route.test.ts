import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runSocialAnalyticsSyncBatchMock } = vi.hoisted(() => ({ runSocialAnalyticsSyncBatchMock: vi.fn() }));
vi.mock("@/core/social/socialAnalyticsSyncExecutor", () => ({ runSocialAnalyticsSyncBatch: runSocialAnalyticsSyncBatchMock }));

import { GET } from "./route";

const ORIGINAL_ENV = { ...process.env };
const CRON_SECRET = "test-cron-secret";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://app.example.com/api/social/analytics/sync", { method: "GET", headers });
}

const EMPTY_SUMMARY = { workspacesConsidered: 0, postsConsidered: 0, postSnapshotsUpserted: 0, accountSnapshotsUpserted: 0, skipped: 0, retryableFailures: 0, terminalFailures: 0 };

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  runSocialAnalyticsSyncBatchMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("GET /api/social/analytics/sync", () => {
  it("rejects a request with no Authorization header — fails closed", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(runSocialAnalyticsSyncBatchMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await GET(request({ authorization: "Bearer wrong-secret" }));
    expect(response.status).toBe(401);
    expect(runSocialAnalyticsSyncBatchMock).not.toHaveBeenCalled();
  });

  it("fails closed with the identical 401 when CRON_SECRET itself is not configured — never an unauthenticated fallback", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request({ authorization: "Bearer wrong-secret" }));
    expect(response.status).toBe(401);
    expect(runSocialAnalyticsSyncBatchMock).not.toHaveBeenCalled();
  });

  it("never accepts caller-supplied workspace/post/account ids — a valid request only ever triggers the batch, nothing more", async () => {
    runSocialAnalyticsSyncBatchMock.mockResolvedValue({ success: true, summary: EMPTY_SUMMARY });
    await GET(new Request("https://app.example.com/api/social/analytics/sync?workspaceId=arbitrary", { headers: { authorization: `Bearer ${CRON_SECRET}` } }));
    expect(runSocialAnalyticsSyncBatchMock).toHaveBeenCalledWith();
  });

  it("accepts a valid request and returns the safe aggregate summary", async () => {
    const summary = { workspacesConsidered: 2, postsConsidered: 5, postSnapshotsUpserted: 4, accountSnapshotsUpserted: 2, skipped: 0, retryableFailures: 1, terminalFailures: 0 };
    runSocialAnalyticsSyncBatchMock.mockResolvedValue({ success: true, summary });
    const response = await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, summary });
  });

  it("surfaces only the safe reason enum on internal failure — never a raw error/exception message", async () => {
    runSocialAnalyticsSyncBatchMock.mockResolvedValue({ success: false, reason: "service_role_unavailable" });
    const response = await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ success: false, reason: "service_role_unavailable" });
  });

  it("a duplicate/replayed valid invocation is harmless — it just re-triggers a scan of whatever is currently eligible", async () => {
    runSocialAnalyticsSyncBatchMock.mockResolvedValue({ success: true, summary: EMPTY_SUMMARY });
    await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(runSocialAnalyticsSyncBatchMock).toHaveBeenCalledTimes(2);
  });

  it("no response body ever contains an access token, credential reference, or client secret", async () => {
    runSocialAnalyticsSyncBatchMock.mockResolvedValue({ success: true, summary: EMPTY_SUMMARY });
    const response = await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    const body = await response.text();
    expect(body).not.toMatch(/access_token|refresh_token|client_secret|CRON_SECRET/i);
  });
});
