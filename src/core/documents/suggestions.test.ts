import { describe, expect, it } from "vitest";
import { getDocumentSuggestions, getMissingSectionSuggestions, getWordingSuggestions } from "@/core/documents/suggestions";
import type { DocumentTypeDefinition, ParagraphBlock, Template } from "@/types/documentPlatform";

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "template_1",
    workspaceId: "ws_1",
    documentTypeId: "contract",
    name: "Test Template",
    description: "",
    status: "draft",
    content: [],
    header: [],
    footer: [],
    variables: [],
    version: 0,
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    createdBy: "member_1",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function paragraph(text: string, id = "p1"): ParagraphBlock {
  return { id, type: "paragraph", runs: [{ text }] };
}

const documentType: DocumentTypeDefinition = {
  id: "contract",
  label: "Contract",
  description: "",
  icon: "FileSignature",
  suggestedMergeFieldKeys: ["client_name", "event_date", "contract_total"],
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
};

describe("getWordingSuggestions", () => {
  it("flags a paragraph containing an informal contraction", () => {
    const template = makeTemplate({ content: [paragraph("Don't worry, we'll handle everything.")] });
    const suggestions = getWordingSuggestions(template);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ kind: "tone", blockId: "p1" });
  });

  it("suggests a formalized replacement for every informal word found", () => {
    const template = makeTemplate({ content: [paragraph("Hey, thanks for booking with us!")] });
    const suggestions = getWordingSuggestions(template);
    expect(suggestions[0].suggestedRuns?.[0].text).toBe("hello, thank you for booking with us!");
  });

  it("returns nothing for a paragraph with no informal language", () => {
    const template = makeTemplate({ content: [paragraph("We are delighted to work with you.")] });
    expect(getWordingSuggestions(template)).toEqual([]);
  });

  it("scans header and footer blocks too, not just content", () => {
    const template = makeTemplate({ header: [paragraph("Yeah, here's the header.", "h1")] });
    const suggestions = getWordingSuggestions(template);
    expect(suggestions[0].blockId).toBe("h1");
  });

  it("recurses into a conditional block's own nested blocks", () => {
    const template = makeTemplate({
      content: [{ id: "c1", type: "conditional", field: "x", operator: "eq", value: 1, blocks: [paragraph("Gonna be great.", "nested")] }],
    });
    const suggestions = getWordingSuggestions(template);
    expect(suggestions[0].blockId).toBe("nested");
  });
});

describe("getMissingSectionSuggestions", () => {
  it("suggests every suggested field the Template never references", () => {
    const template = makeTemplate({ content: [] });
    const suggestions = getMissingSectionSuggestions(template, documentType);
    expect(suggestions.map((s) => s.suggestedRuns?.[0].text)).toEqual(["{{client_name}}", "{{event_date}}", "{{contract_total}}"]);
  });

  it("excludes a field that's already referenced somewhere in the Template", () => {
    const template = makeTemplate({ content: [paragraph("{{client_name}}")] });
    const suggestions = getMissingSectionSuggestions(template, documentType);
    expect(suggestions.map((s) => s.suggestedRuns?.[0].text)).not.toContain("{{client_name}}");
  });

  it("returns nothing when every suggested field is already referenced", () => {
    const template = makeTemplate({ content: [paragraph("{{client_name}} {{event_date}} {{contract_total}}")] });
    expect(getMissingSectionSuggestions(template, documentType)).toEqual([]);
  });

  it("returns nothing when the document type is unknown", () => {
    expect(getMissingSectionSuggestions(makeTemplate(), null)).toEqual([]);
  });

  it("caps suggestions at 3 even if a document type suggests more", () => {
    const bigType: DocumentTypeDefinition = { ...documentType, suggestedMergeFieldKeys: ["a", "b", "c", "d", "e"] };
    const suggestions = getMissingSectionSuggestions(makeTemplate(), bigType);
    expect(suggestions).toHaveLength(3);
  });
});

describe("getDocumentSuggestions", () => {
  it("combines missing-section and wording suggestions", () => {
    const template = makeTemplate({ content: [paragraph("Don't forget {{client_name}}.")] });
    const suggestions = getDocumentSuggestions(template, documentType);
    expect(suggestions.some((s) => s.kind === "missing_section")).toBe(true);
    expect(suggestions.some((s) => s.kind === "tone")).toBe(true);
  });
});
