import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/portal/users/[id]/timeline/route";
import { createApiKey, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

async function authedRequest(): Promise<Request> {
  const { secret } = await createApiKey(CURRENT_WORKSPACE_ID, "member_1", { name: "Test", scopes: ["portal.read"] });
  return new Request("http://localhost/api/v1/portal/users/client_account_1/timeline", { headers: { authorization: `Bearer ${secret}` } });
}

afterEach(() => {
  resetApiKeyStore();
});

describe("GET /api/v1/portal/users/:id/timeline", () => {
  it("returns the account's Timeline for a real, same-workspace account id", async () => {
    const response = await GET((await authedRequest()) as never, { params: Promise.resolve({ id: "client_account_1" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("returns not_found for an account id that doesn't exist, never a 500", async () => {
    const response = await GET((await authedRequest()) as never, { params: Promise.resolve({ id: "does-not-exist" }) });
    expect(response.status).toBe(404);
  });

  it("returns not_found for an account that exists but belongs to a different Workspace — existence never leaks across the boundary", async () => {
    const { secret } = await createApiKey("some-other-workspace", "member_1", { name: "Test", scopes: ["portal.read"] });
    const request = new Request("http://localhost/api/v1/portal/users/client_account_1/timeline", { headers: { authorization: `Bearer ${secret}` } });
    const response = await GET(request as never, { params: Promise.resolve({ id: "client_account_1" }) });
    expect(response.status).toBe(404);
  });
});
