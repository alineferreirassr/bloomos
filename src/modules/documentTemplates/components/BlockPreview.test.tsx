import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockPreview } from "@/modules/documentTemplates/components/BlockPreview";
import type { DocumentBlock } from "@/types/documentPlatform";

describe("BlockPreview", () => {
  it("renders heading and paragraph blocks", () => {
    const blocks: DocumentBlock[] = [
      { id: "b1", type: "heading", level: 2, runs: [{ text: "Welcome" }] },
      { id: "b2", type: "paragraph", runs: [{ text: "Thank you for your inquiry." }] },
    ];
    render(<BlockPreview blocks={blocks} />);

    expect(screen.getByRole("heading", { level: 2, name: "Welcome" })).toBeInTheDocument();
    expect(screen.getByText("Thank you for your inquiry.")).toBeInTheDocument();
  });

  it("renders a table block", () => {
    const blocks: DocumentBlock[] = [
      { id: "b1", type: "table", rows: [[[{ text: "Item" }], [{ text: "Qty" }]], [[{ text: "Roses" }], [{ text: "12" }]]] },
    ];
    render(<BlockPreview blocks={blocks} />);

    expect(screen.getByText("Item")).toBeInTheDocument();
    expect(screen.getByText("Roses")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders an image block and a pageBreak block", () => {
    const blocks: DocumentBlock[] = [
      { id: "b1", type: "image", src: "https://example.com/photo.png", alt: "Venue photo" },
      { id: "b2", type: "pageBreak" },
    ];
    render(<BlockPreview blocks={blocks} />);

    expect(screen.getByRole("img", { name: "Venue photo" })).toBeInTheDocument();
    expect(screen.getByText("Page Break")).toBeInTheDocument();
  });

  it("renders a conditional block's nested content with its condition summary", () => {
    const blocks: DocumentBlock[] = [
      {
        id: "b1",
        type: "conditional",
        field: "budget",
        operator: "gt",
        value: 5000,
        blocks: [{ id: "b1-1", type: "paragraph", runs: [{ text: "Premium tier applies." }] }],
      },
    ];
    render(<BlockPreview blocks={blocks} />);

    expect(screen.getByText(/If budget gt/)).toBeInTheDocument();
    expect(screen.getByText("Premium tier applies.")).toBeInTheDocument();
  });

  it("renders a loop block's nested content with its source summary", () => {
    const blocks: DocumentBlock[] = [
      {
        id: "b1",
        type: "loop",
        source: "line_items",
        itemBlocks: [{ id: "b1-1", type: "paragraph", runs: [{ text: "{{item.name}}" }] }],
      },
    ];
    render(<BlockPreview blocks={blocks} />);

    expect(screen.getByText(/For each item in line_items/)).toBeInTheDocument();
    expect(screen.getByText("{{item.name}}")).toBeInTheDocument();
  });
});
