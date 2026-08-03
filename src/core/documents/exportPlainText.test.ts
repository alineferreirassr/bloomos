import { describe, expect, it } from "vitest";
import { blocksToPlainText } from "@/core/documents/exportPlainText";
import type { DocumentBlock } from "@/types/documentPlatform";

describe("blocksToPlainText", () => {
  it("uppercases a heading's own text", () => {
    const blocks: DocumentBlock[] = [{ id: "h1", type: "heading", level: 1, runs: [{ text: "Wedding Contract" }] }];
    expect(blocksToPlainText(blocks)).toBe("WEDDING CONTRACT");
  });

  it("renders a paragraph's own text as-is", () => {
    const blocks: DocumentBlock[] = [{ id: "p1", type: "paragraph", runs: [{ text: "Dear Alex Rivera," }] }];
    expect(blocksToPlainText(blocks)).toBe("Dear Alex Rivera,");
  });

  it("joins multiple blocks with a blank line between them", () => {
    const blocks: DocumentBlock[] = [
      { id: "h1", type: "heading", level: 1, runs: [{ text: "Title" }] },
      { id: "p1", type: "paragraph", runs: [{ text: "Body" }] },
    ];
    expect(blocksToPlainText(blocks)).toBe("TITLE\n\nBody");
  });

  it("renders a table as tab-separated rows", () => {
    const blocks: DocumentBlock[] = [{ id: "t1", type: "table", rows: [[[{ text: "A" }], [{ text: "B" }]]] }];
    expect(blocksToPlainText(blocks)).toBe("A\tB");
  });

  it("renders an image's own alt text", () => {
    const blocks: DocumentBlock[] = [{ id: "i1", type: "image", src: "https://example.com/x.png", alt: "logo" }];
    expect(blocksToPlainText(blocks)).toBe("[Image: logo]");
  });

  it("recurses into a conditional block's own nested blocks, without a wrapper line", () => {
    const blocks: DocumentBlock[] = [
      { id: "c1", type: "conditional", field: "x", operator: "eq", value: 1, blocks: [{ id: "p1", type: "paragraph", runs: [{ text: "Nested" }] }] },
    ];
    expect(blocksToPlainText(blocks)).toBe("Nested");
  });
});
