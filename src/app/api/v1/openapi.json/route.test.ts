import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/v1/openapi.json/route";
import { OPENAPI_DOCUMENT } from "@/core/api/openapi";

describe("GET /api/v1/openapi.json", () => {
  it("serves the OpenAPI document unauthenticated — no Authorization header required", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(OPENAPI_DOCUMENT);
  });
});
