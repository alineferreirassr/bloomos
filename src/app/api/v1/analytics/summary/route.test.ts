import { afterEach, describe, expect, it, vi } from "vitest";

// `getAnalyticsDashboardData.ts` also exports the session-based (never
// called by this route) `getAnalyticsDashboardData`, which pulls in
// `next/headers` via `resolveMemberSessionSnapshot` — real `server-only`
// code that throws under Vitest's jsdom environment the moment the module
// loads. This route only ever calls the API-Key-based sibling, so the
// session resolver is mocked out here purely to keep the module graph
// loadable, the same "mock what you don't need to keep loadable" precedent
// `getAnalyticsDashboardData.test.ts` itself already established.
vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { GET } from "@/app/api/v1/analytics/summary/route";
import { createApiKey, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";

async function authedRequest(query = ""): Promise<Request> {
  const { secret } = await createApiKey("ws_1", "member_1", { name: "Test", scopes: ["analytics.read"] });
  return new Request(`http://localhost/api/v1/analytics/summary${query}`, { headers: { authorization: `Bearer ${secret}` } });
}

afterEach(() => {
  resetApiKeyStore();
});

describe("GET /api/v1/analytics/summary", () => {
  it("requires the analytics.read scope", async () => {
    const { secret } = await createApiKey("ws_1", "member_1", { name: "Test", scopes: ["crm.read"] });
    const response = await GET(new Request("http://localhost/api/v1/analytics/summary", { headers: { authorization: `Bearer ${secret}` } }) as never);
    expect(response.status).toBe(403);
  });

  it("returns byCategory/overview for the default 30d window, treating a valid Key as full internal visibility", async () => {
    const response = await GET((await authedRequest()) as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.windowKey).toBe("30d");
    expect(body.data.byCategory).toBeTruthy();
    expect(Array.isArray(body.data.overview)).toBe(true);
  });

  it("honors ?window=year", async () => {
    const response = await GET((await authedRequest("?window=year")) as never);
    const body = await response.json();
    expect(body.data.windowKey).toBe("year");
  });

  it("returns invalid_request for an unrecognized ?window= value", async () => {
    const response = await GET((await authedRequest("?window=nonsense")) as never);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("invalid_request");
  });
});
