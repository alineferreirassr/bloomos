import { beforeEach, describe, expect, it } from "vitest";
import { getMergeField, listMergeFields, listMergeFieldsByDomain, registerMergeField, resetMergeFieldRegistry, unregisterMergeField } from "@/core/documents/mergeFieldRegistry";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

function makeField(overrides: Partial<MergeFieldDefinition> = {}): MergeFieldDefinition {
  return { key: "test_field", label: "Test Field", description: "", domain: "workspace", valueType: "string", required: false, ...overrides };
}

describe("Merge Field Registry", () => {
  beforeEach(() => {
    resetMergeFieldRegistry();
  });

  it("registers and retrieves a merge field by key", () => {
    registerMergeField(makeField());
    expect(getMergeField("test_field")?.label).toBe("Test Field");
  });

  it("returns undefined for a key that was never registered", () => {
    expect(getMergeField("nonexistent")).toBeUndefined();
  });

  it("re-registering the same key overwrites rather than duplicates", () => {
    registerMergeField(makeField({ label: "First" }));
    registerMergeField(makeField({ label: "Second" }));
    expect(listMergeFields()).toHaveLength(1);
    expect(getMergeField("test_field")?.label).toBe("Second");
  });

  it("unregisterMergeField removes it from every listing", () => {
    registerMergeField(makeField());
    unregisterMergeField("test_field");
    expect(getMergeField("test_field")).toBeUndefined();
    expect(listMergeFields()).toEqual([]);
  });

  it("listMergeFieldsByDomain scopes strictly to one domain", () => {
    registerMergeField(makeField({ key: "a", domain: "crm" }));
    registerMergeField(makeField({ key: "b", domain: "finance" }));
    expect(listMergeFieldsByDomain("crm").map((f) => f.key)).toEqual(["a"]);
  });

  it("resetMergeFieldRegistry clears every registered field", () => {
    registerMergeField(makeField());
    resetMergeFieldRegistry();
    expect(listMergeFields()).toEqual([]);
  });
});
