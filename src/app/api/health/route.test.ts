import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";
import packageJson from "../../../../package.json";

describe("GET /api/health", () => {
  it("returns status ok with the current package version and a timestamp", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.version).toBe(packageJson.version);
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });
});
