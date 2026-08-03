import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/clients/[id]/route";
import { createApiKey, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import { resetAllMockData } from "@/lib/data";

async function authedRequest(): Promise<Request> {
  const { secret } = await createApiKey("ws_1", "member_1", { name: "Test", scopes: ["crm.read"] });
  return new Request("http://localhost/api/v1/clients/client_1", { headers: { authorization: `Bearer ${secret}` } });
}

afterEach(() => {
  resetApiKeyStore();
  resetAllMockData();
});

describe("GET /api/v1/clients/:id", () => {
  it("returns the redacted Client for a real id", async () => {
    const response = await GET((await authedRequest()) as never, { params: Promise.resolve({ id: "client_1" }) });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.id).toBe("client_1");
    expect(body.data).not.toHaveProperty("allergies");
  });

  it("returns a not_found ApiError (never an unhandled 500) for an unknown id", async () => {
    const response = await GET((await authedRequest()) as never, { params: Promise.resolve({ id: "does-not-exist" }) });
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe("not_found");
  });
});
