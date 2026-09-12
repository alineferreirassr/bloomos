import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runScheduledSocialPostBatchMock } = vi.hoisted(() => ({ runScheduledSocialPostBatchMock: vi.fn() }));
vi.mock("@/core/social/scheduledPostExecutor", () => ({ runScheduledSocialPostBatch: runScheduledSocialPostBatchMock }));

import { GET } from "./route";

const ORIGINAL_ENV = { ...process.env };
const CRON_SECRET = "test-cron-secret";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://app.example.com/api/social/scheduler", { method: "GET", headers });
}

beforeEach(() => {
  process.env.CRON_SECRET = CRON_SECRET;
  runScheduledSocialPostBatchMock.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.clearAllMocks();
});

describe("GET /api/social/scheduler", () => {
  it("rejects a request with no Authorization header — fails closed", async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(runScheduledSocialPostBatchMock).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong secret", async () => {
    const response = await GET(request({ authorization: "Bearer wrong-secret" }));
    expect(response.status).toBe(401);
    expect(runScheduledSocialPostBatchMock).not.toHaveBeenCalled();
  });

  it("fails closed with the identical 401 when CRON_SECRET itself is not configured — never an unauthenticated fallback", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(request({ authorization: "Bearer wrong-secret" }));
    expect(response.status).toBe(401);
    expect(runScheduledSocialPostBatchMock).not.toHaveBeenCalled();
  });

  it("never accepts caller-supplied post ids or any other input — a valid request only ever triggers the batch, nothing more", async () => {
    runScheduledSocialPostBatchMock.mockResolvedValue({ success: true, summary: { reclaimed: 0, claimed: 0, published: 0, failedRetryable: 0, failedTerminal: 0 } });
    await GET(new Request("https://app.example.com/api/social/scheduler?postId=arbitrary", { headers: { authorization: `Bearer ${CRON_SECRET}` } }));
    expect(runScheduledSocialPostBatchMock).toHaveBeenCalledWith();
  });

  it("accepts a valid request and returns the safe aggregate summary", async () => {
    const summary = { reclaimed: 1, claimed: 3, published: 2, failedRetryable: 1, failedTerminal: 0 };
    runScheduledSocialPostBatchMock.mockResolvedValue({ success: true, summary });
    const response = await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true, summary });
  });

  it("surfaces only the safe reason enum on internal failure — never a raw error/exception message", async () => {
    runScheduledSocialPostBatchMock.mockResolvedValue({ success: false, reason: "claim_failed" });
    const response = await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({ success: false, reason: "claim_failed" });
  });

  it("a duplicate/replayed valid invocation is harmless — it just re-triggers a claim of whatever is actually due", async () => {
    runScheduledSocialPostBatchMock.mockResolvedValue({ success: true, summary: { reclaimed: 0, claimed: 0, published: 0, failedRetryable: 0, failedTerminal: 0 } });
    await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    await GET(request({ authorization: `Bearer ${CRON_SECRET}` }));
    expect(runScheduledSocialPostBatchMock).toHaveBeenCalledTimes(2);
  });
});
