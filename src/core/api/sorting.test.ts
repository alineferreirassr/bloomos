import { describe, expect, it } from "vitest";
import { parseSort, applySort } from "@/core/api/sorting";

const FIELDS = ["name", "created_at"] as const;

describe("parseSort", () => {
  it("returns null when ?sort= is absent", () => {
    expect(parseSort(new URL("http://localhost/api/v1/clients"), FIELDS)).toBeNull();
  });

  it("parses an ascending field", () => {
    expect(parseSort(new URL("http://localhost/api/v1/clients?sort=name"), FIELDS)).toEqual({ field: "name", direction: "asc" });
  });

  it("parses a descending field prefixed with -", () => {
    expect(parseSort(new URL("http://localhost/api/v1/clients?sort=-created_at"), FIELDS)).toEqual({ field: "created_at", direction: "desc" });
  });

  it("returns null for a field not in the allowed set — never sorts by an arbitrary field", () => {
    expect(parseSort(new URL("http://localhost/api/v1/clients?sort=ssn"), FIELDS)).toBeNull();
  });
});

describe("applySort", () => {
  const items = [{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }];

  it("returns items unchanged when sort is null", () => {
    expect(applySort(items, null, (item) => item.name)).toEqual(items);
  });

  it("sorts ascending", () => {
    const sorted = applySort(items, { field: "name", direction: "asc" }, (item) => item.name);
    expect(sorted.map((i) => i.name)).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts descending", () => {
    const sorted = applySort(items, { field: "name", direction: "desc" }, (item) => item.name);
    expect(sorted.map((i) => i.name)).toEqual(["Charlie", "Bob", "Alice"]);
  });

  it("never mutates the original array", () => {
    const copy = [...items];
    applySort(items, { field: "name", direction: "asc" }, (item) => item.name);
    expect(items).toEqual(copy);
  });
});
