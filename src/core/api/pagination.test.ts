import { describe, expect, it } from "vitest";
import { parsePagination, paginate } from "@/core/api/pagination";

describe("parsePagination", () => {
  it("defaults to page 1, 25 per page when no query params are given", () => {
    expect(parsePagination(new URL("http://localhost/api/v1/clients"))).toEqual({ page: 1, perPage: 25 });
  });

  it("reads ?page= and ?per_page=", () => {
    expect(parsePagination(new URL("http://localhost/api/v1/clients?page=3&per_page=10"))).toEqual({ page: 3, perPage: 10 });
  });

  it("clamps per_page to a maximum of 100", () => {
    expect(parsePagination(new URL("http://localhost/api/v1/clients?per_page=500")).perPage).toBe(100);
  });

  it("clamps page below 1 up to 1", () => {
    expect(parsePagination(new URL("http://localhost/api/v1/clients?page=0")).page).toBe(1);
  });

  it("falls back to defaults for non-numeric values", () => {
    expect(parsePagination(new URL("http://localhost/api/v1/clients?page=abc&per_page=xyz"))).toEqual({ page: 1, perPage: 25 });
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it("slices to the requested page and reports accurate meta", () => {
    const { items: page1, meta } = paginate(items, { page: 1, perPage: 10 });
    expect(page1).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(meta).toEqual({ page: 1, perPage: 10, total: 23, totalPages: 3 });

    const { items: page3 } = paginate(items, { page: 3, perPage: 10 });
    expect(page3).toEqual([21, 22, 23]);
  });

  it("returns an empty page past the end, never an error", () => {
    const { items: page, meta } = paginate(items, { page: 99, perPage: 10 });
    expect(page).toEqual([]);
    expect(meta.total).toBe(23);
  });

  it("handles an empty input list — totalPages is still at least 1, never 0", () => {
    const { items: page, meta } = paginate([], { page: 1, perPage: 25 });
    expect(page).toEqual([]);
    expect(meta).toEqual({ page: 1, perPage: 25, total: 0, totalPages: 1 });
  });
});
