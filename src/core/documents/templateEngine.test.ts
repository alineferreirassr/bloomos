import { describe, expect, it } from "vitest";
import { extractPlaceholdersFromText, extractTemplateFields, renderBlocks } from "@/core/documents/templateEngine";
import type { DocumentBlock, ParagraphBlock } from "@/types/documentPlatform";

function paragraph(text: string, id = "p1"): ParagraphBlock {
  return { id, type: "paragraph", runs: [{ text }] };
}

describe("extractPlaceholdersFromText", () => {
  it("finds a single placeholder", () => {
    expect(extractPlaceholdersFromText("Hello {{client_name}}")).toEqual(["client_name"]);
  });

  it("finds multiple distinct placeholders", () => {
    expect(extractPlaceholdersFromText("{{a}} and {{b}}")).toEqual(["a", "b"]);
  });

  it("deduplicates a repeated placeholder", () => {
    expect(extractPlaceholdersFromText("{{a}} again {{a}}")).toEqual(["a"]);
  });

  it("finds a dotted path placeholder", () => {
    expect(extractPlaceholdersFromText("{{item.description}}")).toEqual(["item.description"]);
  });

  it("returns nothing for plain text with no placeholders", () => {
    expect(extractPlaceholdersFromText("Hello there")).toEqual([]);
  });

  it("tolerates whitespace inside the braces", () => {
    expect(extractPlaceholdersFromText("{{ client_name }}")).toEqual(["client_name"]);
  });
});

describe("extractTemplateFields", () => {
  it("collects fields from paragraph and heading runs", () => {
    const blocks: DocumentBlock[] = [
      { id: "h1", type: "heading", level: 1, runs: [{ text: "{{workspace_name}}" }] },
      paragraph("Dear {{client_name}}"),
    ];
    expect(extractTemplateFields(blocks)).toEqual(expect.arrayContaining(["workspace_name", "client_name"]));
  });

  it("collects fields from table cells", () => {
    const blocks: DocumentBlock[] = [{ id: "t1", type: "table", rows: [[[{ text: "{{invoice_total}}" }]]] }];
    expect(extractTemplateFields(blocks)).toEqual(["invoice_total"]);
  });

  it("collects fields from an image's src and alt", () => {
    const blocks: DocumentBlock[] = [{ id: "i1", type: "image", src: "{{logo_url}}", alt: "{{workspace_name}} logo" }];
    expect(extractTemplateFields(blocks)).toEqual(expect.arrayContaining(["logo_url", "workspace_name"]));
  });

  it("collects a conditional's own field plus fields nested inside its blocks", () => {
    const blocks: DocumentBlock[] = [
      { id: "c1", type: "conditional", field: "invoice_balance", operator: "gt", value: 0, blocks: [paragraph("Balance: {{invoice_balance}}")] },
    ];
    expect(extractTemplateFields(blocks)).toEqual(expect.arrayContaining(["invoice_balance"]));
  });

  it("collects a loop's own source plus fields nested inside its itemBlocks", () => {
    const blocks: DocumentBlock[] = [{ id: "l1", type: "loop", source: "line_items", itemBlocks: [paragraph("{{item.description}}")] }];
    expect(extractTemplateFields(blocks)).toEqual(expect.arrayContaining(["line_items", "item.description"]));
  });

  it("returns nothing for a pageBreak or divider block", () => {
    const blocks: DocumentBlock[] = [{ id: "pb", type: "pageBreak" }, { id: "d", type: "divider" }];
    expect(extractTemplateFields(blocks)).toEqual([]);
  });
});

describe("renderBlocks", () => {
  it("substitutes a top-level scalar placeholder", () => {
    const rendered = renderBlocks([paragraph("Dear {{client_name}},")], { client_name: "Alex Rivera" });
    expect((rendered[0] as ParagraphBlock).runs[0].text).toBe("Dear Alex Rivera,");
  });

  it("renders an unresolved placeholder as an empty string", () => {
    const rendered = renderBlocks([paragraph("Dear {{client_name}},")], {});
    expect((rendered[0] as ParagraphBlock).runs[0].text).toBe("Dear ,");
  });

  it("preserves bold/italic/underline formatting through substitution", () => {
    const blocks: DocumentBlock[] = [{ id: "p1", type: "paragraph", runs: [{ text: "{{client_name}}", bold: true, italic: true }] }];
    const rendered = renderBlocks(blocks, { client_name: "Alex" });
    expect((rendered[0] as ParagraphBlock).runs[0]).toMatchObject({ text: "Alex", bold: true, italic: true });
  });

  it("substitutes placeholders inside every table cell", () => {
    const blocks: DocumentBlock[] = [{ id: "t1", type: "table", rows: [[[{ text: "{{invoice_total}}" }], [{ text: "static" }]]] }];
    const rendered = renderBlocks(blocks, { invoice_total: "$500" });
    expect(rendered[0]).toMatchObject({ type: "table", rows: [[[{ text: "$500" }], [{ text: "static" }]]] });
  });

  it("substitutes a merge-field image src", () => {
    const blocks: DocumentBlock[] = [{ id: "i1", type: "image", src: "{{logo_url}}", alt: "logo" }];
    const rendered = renderBlocks(blocks, { logo_url: "https://example.com/logo.png" });
    expect(rendered[0]).toMatchObject({ type: "image", src: "https://example.com/logo.png" });
  });

  it("passes pageBreak and divider blocks through unchanged", () => {
    const blocks: DocumentBlock[] = [{ id: "pb", type: "pageBreak" }, { id: "d", type: "divider" }];
    expect(renderBlocks(blocks, {})).toEqual(blocks);
  });

  it("includes a conditional's own blocks when the condition passes, flattened into the output", () => {
    const blocks: DocumentBlock[] = [
      { id: "c1", type: "conditional", field: "invoice_balance", operator: "gt", value: 0, blocks: [paragraph("You owe {{invoice_balance}}")] },
    ];
    const rendered = renderBlocks(blocks, { invoice_balance: 250 });
    expect(rendered).toHaveLength(1);
    expect(rendered[0].type).toBe("paragraph");
    expect((rendered[0] as ParagraphBlock).runs[0].text).toBe("You owe 250");
  });

  it("omits a conditional's own blocks entirely when the condition fails", () => {
    const blocks: DocumentBlock[] = [
      { id: "c1", type: "conditional", field: "invoice_balance", operator: "gt", value: 0, blocks: [paragraph("You owe {{invoice_balance}}")] },
    ];
    expect(renderBlocks(blocks, { invoice_balance: 0 })).toEqual([]);
  });

  it("expands a loop once per list element, each with its own item scope", () => {
    const blocks: DocumentBlock[] = [{ id: "l1", type: "loop", source: "line_items", itemBlocks: [paragraph("{{item.description}}: {{item.amount}}")] }];
    const rendered = renderBlocks(blocks, {
      line_items: [
        { description: "Photography", amount: "$1000" },
        { description: "Videography", amount: "$800" },
      ],
    });
    expect(rendered).toHaveLength(2);
    expect((rendered[0] as ParagraphBlock).runs[0].text).toBe("Photography: $1000");
    expect((rendered[1] as ParagraphBlock).runs[0].text).toBe("Videography: $800");
  });

  it("expands a loop over scalar list elements via the bare {{item}} reference", () => {
    const blocks: DocumentBlock[] = [{ id: "l1", type: "loop", source: "tags", itemBlocks: [paragraph("Tag: {{item}}")] }];
    const rendered = renderBlocks(blocks, { tags: ["vip", "returning"] });
    expect((rendered[0] as ParagraphBlock).runs[0].text).toBe("Tag: vip");
    expect((rendered[1] as ParagraphBlock).runs[0].text).toBe("Tag: returning");
  });

  it("produces zero blocks for a loop whose source isn't a list", () => {
    const blocks: DocumentBlock[] = [{ id: "l1", type: "loop", source: "client_name", itemBlocks: [paragraph("{{item}}")] }];
    expect(renderBlocks(blocks, { client_name: "Alex" })).toEqual([]);
  });

  it("recurses correctly through a conditional nested inside a loop", () => {
    const blocks: DocumentBlock[] = [
      {
        id: "l1",
        type: "loop",
        source: "line_items",
        itemBlocks: [{ id: "c1", type: "conditional", field: "item.amount", operator: "gt", value: 500, blocks: [paragraph("Large: {{item.description}}")] }],
      },
    ];
    const rendered = renderBlocks(blocks, {
      line_items: [
        { description: "Photography", amount: 1000 },
        { description: "Cards", amount: 50 },
      ],
    });
    expect(rendered).toHaveLength(1);
    expect((rendered[0] as ParagraphBlock).runs[0].text).toBe("Large: Photography");
  });
});
