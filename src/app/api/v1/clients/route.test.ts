import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/clients/route";
import { createApiKey, resetApiKeyStore } from "@/lib/data/core/api/apiKeyStore";
import { resetAllMockData } from "@/lib/data";

async function requestWithScopes(scopes: import("@/types/apiScope").ApiScope[], query = ""): Promise<Request> {
  const { secret } = await createApiKey("ws_1", "member_1", { name: "Test", scopes });
  return new Request(`http://localhost/api/v1/clients${query}`, { headers: { authorization: `Bearer ${secret}` } });
}

afterEach(() => {
  resetApiKeyStore();
  resetAllMockData();
});

describe("GET /api/v1/clients", () => {
  it("requires authentication", async () => {
    const response = await GET(new Request("http://localhost/api/v1/clients") as never);
    expect(response.status).toBe(401);
  });

  it("requires the crm.read scope", async () => {
    const response = await GET((await requestWithScopes(["finance.read"])) as never);
    expect(response.status).toBe(403);
  });

  it("returns a paginated, redacted list of Clients for a valid crm.read key", async () => {
    const response = await GET((await requestWithScopes(["crm.read"])) as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.meta).toMatchObject({ page: 1, perPage: 25 });
    for (const client of body.data) {
      expect(client).not.toHaveProperty("allergies");
      expect(client).not.toHaveProperty("internal_status");
      expect(client).toHaveProperty("status");
    }
  });

  it("respects ?per_page= for pagination", async () => {
    const response = await GET((await requestWithScopes(["crm.read"], "?per_page=1")) as never);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.meta.perPage).toBe(1);
  });

  it("supports ?sort=name and ?sort=-name", async () => {
    const asc = await (await GET((await requestWithScopes(["crm.read"], "?sort=name")) as never)).json();
    const desc = await (await GET((await requestWithScopes(["crm.read"], "?sort=-name")) as never)).json();
    expect(asc.data.map((c: { id: string }) => c.id)).toEqual([...desc.data].reverse().map((c: { id: string }) => c.id));
  });
});
