import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BlockEditor } from "@/modules/documentTemplates/components/BlockEditor";
import type { DocumentBlock } from "@/types/documentPlatform";

describe("BlockEditor", () => {
  it("renders existing blocks with their type labels", () => {
    const blocks: DocumentBlock[] = [
      { id: "b1", type: "heading", level: 2, runs: [{ text: "Welcome" }] },
      { id: "b2", type: "paragraph", runs: [{ text: "Body text" }] },
    ];
    render(<BlockEditor blocks={blocks} onChange={vi.fn()} />);

    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("Paragraph")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Welcome")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Body text")).toBeInTheDocument();
  });

  it("calls onChange with updated block data when a paragraph's text is edited", async () => {
    const blocks: DocumentBlock[] = [{ id: "b1", type: "paragraph", runs: [{ text: "Original" }] }];
    const onChange = vi.fn();
    render(<BlockEditor blocks={blocks} onChange={onChange} />);

    const { default: userEvent } = await import("@testing-library/user-event");
    const textarea = screen.getByPlaceholderText(/Paragraph text/);
    await userEvent.type(textarea, "!");

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0] as DocumentBlock[];
    expect(lastCall[0]).toMatchObject({ id: "b1", type: "paragraph" });
  });

  it("moves a block down and up via the reorder controls", async () => {
    const blocks: DocumentBlock[] = [
      { id: "b1", type: "paragraph", runs: [{ text: "First" }] },
      { id: "b2", type: "paragraph", runs: [{ text: "Second" }] },
    ];
    const onChange = vi.fn();
    render(<BlockEditor blocks={blocks} onChange={onChange} />);

    const { default: userEvent } = await import("@testing-library/user-event");
    const downButtons = screen.getAllByRole("button", { name: "↓" });
    await userEvent.click(downButtons[0]);

    const reordered = onChange.mock.calls[0][0] as DocumentBlock[];
    expect(reordered.map((b) => b.id)).toEqual(["b2", "b1"]);
  });

  it("removes a block", async () => {
    const blocks: DocumentBlock[] = [
      { id: "b1", type: "paragraph", runs: [{ text: "Keep me" }] },
      { id: "b2", type: "paragraph", runs: [{ text: "Remove me" }] },
    ];
    const onChange = vi.fn();
    render(<BlockEditor blocks={blocks} onChange={onChange} />);

    const { default: userEvent } = await import("@testing-library/user-event");
    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    await userEvent.click(removeButtons[1]);

    const remaining = onChange.mock.calls[0][0] as DocumentBlock[];
    expect(remaining.map((b) => b.id)).toEqual(["b1"]);
  });

  it("adds a new block from the toolbar", async () => {
    const onChange = vi.fn();
    render(<BlockEditor blocks={[]} onChange={onChange} />);

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "+ Divider" }));

    const next = onChange.mock.calls[0][0] as DocumentBlock[];
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe("divider");
  });

  it("adds a row to a table block", async () => {
    const blocks: DocumentBlock[] = [{ id: "b1", type: "table", rows: [[[{ text: "A" }], [{ text: "B" }]]] }];
    const onChange = vi.fn();
    render(<BlockEditor blocks={blocks} onChange={onChange} />);

    const { default: userEvent } = await import("@testing-library/user-event");
    await userEvent.click(screen.getByRole("button", { name: "+ Row" }));

    const next = onChange.mock.calls[0][0] as DocumentBlock[];
    const table = next[0] as Extract<DocumentBlock, { type: "table" }>;
    expect(table.rows).toHaveLength(2);
  });
});
