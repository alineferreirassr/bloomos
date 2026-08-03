import { describe, expect, it } from "vitest";
import { apiSuccess, apiErrorResponse } from "@/core/api/response";

describe("apiSuccess", () => {
  it("wraps data in {data} with status 200 by default", async () => {
    const response = apiSuccess({ id: "1" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: "1" } });
  });

  it("includes meta only when provided", async () => {
    const withMeta = apiSuccess([1, 2], { page: 1, perPage: 25, total: 2, totalPages: 1 });
    expect(await withMeta.json()).toEqual({ data: [1, 2], meta: { page: 1, perPage: 25, total: 2, totalPages: 1 } });

    const withoutMeta = apiSuccess([1, 2]);
    const body = await withoutMeta.json();
    expect(body).not.toHaveProperty("meta");
  });

  it("supports a custom status", () => {
    expect(apiSuccess({}, undefined, 201).status).toBe(201);
  });
});

describe("apiErrorResponse", () => {
  it("wraps the code/message in the {error} envelope with the code's own mapped status", async () => {
    const response = apiErrorResponse("not_found", "No client with that id.");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message: "No client with that id." } });
  });
});
