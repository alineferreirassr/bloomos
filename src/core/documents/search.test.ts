import { beforeEach, describe, expect, it } from "vitest";
import { searchDocuments } from "@/core/documents/search";
import { registerMergeField, resetMergeFieldRegistry } from "@/core/documents/mergeFieldRegistry";
import type { ComposedDocument, ParagraphBlock, Template } from "@/types/documentPlatform";

function paragraph(text: string, id = "p1"): ParagraphBlock {
  return { id, type: "paragraph", runs: [{ text }] };
}

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "template_1",
    workspaceId: "ws_1",
    documentTypeId: "contract",
    name: "Wedding Photography Contract",
    description: "Standard photography contract.",
    status: "published",
    content: [],
    header: [],
    footer: [],
    variables: [],
    version: 1,
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    createdBy: "member_1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeDocument(overrides: Partial<ComposedDocument> = {}): ComposedDocument {
  return {
    id: "document_1",
    workspaceId: "ws_1",
    templateId: "template_1",
    documentTypeId: "contract",
    status: "draft",
    content: [],
    mergeContext: { workspaceId: "ws_1", memberId: "member_1" },
    metadata: { title: "Rivera Contract", description: "", tags: [], clientName: "Alex Rivera", eventTitle: "Rivera Wedding" },
    currentVersion: 0,
    createdBy: "member_1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("searchDocuments", () => {
  beforeEach(() => {
    resetMergeFieldRegistry();
    registerMergeField({ key: "client_name", label: "Client Name", description: "", domain: "crm", valueType: "string", required: false });
  });

  it("returns nothing for an empty query", () => {
    expect(searchDocuments("", [makeTemplate()], [makeDocument()])).toEqual([]);
  });

  it("finds a Template by its own title", () => {
    const results = searchDocuments("wedding photography", [makeTemplate()], []);
    expect(results[0]).toMatchObject({ kind: "template", id: "template_1" });
  });

  it("finds a Document by its own client name", () => {
    const results = searchDocuments("alex rivera", [], [makeDocument()]);
    expect(results[0]).toMatchObject({ kind: "document", id: "document_1" });
  });

  it("finds a Document by its own event title", () => {
    const results = searchDocuments("rivera wedding", [], [makeDocument()]);
    expect(results[0].id).toBe("document_1");
  });

  it("finds a Template that references a given Merge Field key", () => {
    const template = makeTemplate({ content: [paragraph("Dear {{client_name}},")] });
    const results = searchDocuments("client_name", [template], []);
    expect(results[0].id).toBe("template_1");
  });

  it("finds a Template that references a Merge Field by its own label", () => {
    const template = makeTemplate({ content: [paragraph("Dear {{client_name}},")] });
    const results = searchDocuments("client name", [template], []);
    expect(results[0].id).toBe("template_1");
  });

  it("finds a Template by plain content text", () => {
    const template = makeTemplate({ content: [paragraph("This agreement covers photography services.")] });
    const results = searchDocuments("photography services", [template], []);
    expect(results[0].id).toBe("template_1");
  });

  it("finds a Document by its own compiled content text", () => {
    const document = makeDocument({ content: [paragraph("The remaining balance is due on delivery.")] });
    const results = searchDocuments("remaining balance", [], [document]);
    expect(results[0].id).toBe("document_1");
  });

  it("ranks an exact title match above a mere content match", () => {
    const exactMatch = makeTemplate({ id: "exact", name: "Invoice" });
    const contentMatch = makeTemplate({ id: "content-only", name: "Something Else", content: [paragraph("Please review the invoice details.")] });
    const results = searchDocuments("invoice", [exactMatch, contentMatch], []);
    expect(results[0].id).toBe("exact");
  });

  it("returns both a matching Template and a matching Document together, sorted by score", () => {
    const results = searchDocuments("wedding", [makeTemplate()], [makeDocument()]);
    expect(results.map((r) => r.kind).sort()).toEqual(["document", "template"]);
  });

  it("caps results at 20", () => {
    const templates = Array.from({ length: 30 }, (_, i) => makeTemplate({ id: `t${i}`, name: `Contract ${i}` }));
    const results = searchDocuments("contract", templates, []);
    expect(results.length).toBeLessThanOrEqual(20);
  });
});
