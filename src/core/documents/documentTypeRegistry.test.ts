import { beforeEach, describe, expect, it } from "vitest";
import { getDocumentType, listDocumentTypes, registerDocumentType, resetDocumentTypeRegistry, unregisterDocumentType } from "@/core/documents/documentTypeRegistry";
import type { DocumentTypeDefinition } from "@/types/documentPlatform";

function makeType(overrides: Partial<DocumentTypeDefinition> = {}): DocumentTypeDefinition {
  return {
    id: "test-type",
    label: "Test Type",
    description: "",
    icon: "FileText",
    suggestedMergeFieldKeys: [],
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    ...overrides,
  };
}

describe("Document Type Registry", () => {
  beforeEach(() => {
    resetDocumentTypeRegistry();
  });

  it("registers and retrieves a document type by id", () => {
    registerDocumentType(makeType());
    expect(getDocumentType("test-type")?.label).toBe("Test Type");
  });

  it("returns undefined for an id that was never registered", () => {
    expect(getDocumentType("nonexistent")).toBeUndefined();
  });

  it("re-registering the same id overwrites rather than duplicates", () => {
    registerDocumentType(makeType({ label: "First" }));
    registerDocumentType(makeType({ label: "Second" }));
    expect(listDocumentTypes()).toHaveLength(1);
    expect(getDocumentType("test-type")?.label).toBe("Second");
  });

  it("unregisterDocumentType removes it from every listing", () => {
    registerDocumentType(makeType());
    unregisterDocumentType("test-type");
    expect(getDocumentType("test-type")).toBeUndefined();
    expect(listDocumentTypes()).toEqual([]);
  });

  it("listDocumentTypes sorts alphabetically by label", () => {
    registerDocumentType(makeType({ id: "z", label: "Zebra" }));
    registerDocumentType(makeType({ id: "a", label: "Alpha" }));
    expect(listDocumentTypes().map((t) => t.id)).toEqual(["a", "z"]);
  });

  it("resetDocumentTypeRegistry clears every registered type", () => {
    registerDocumentType(makeType());
    resetDocumentTypeRegistry();
    expect(listDocumentTypes()).toEqual([]);
  });
});
