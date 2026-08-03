import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateCategoryList } from "@/modules/services/components/TemplateCategoryList";
import { includedItemAdapter, seasonalWindowAdapter } from "@/modules/services/templateCategoryAdapters";

const rowBase = { workspace_id: "ws_1", service_version_id: "draft_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };

const rows = [
  { ...rowBase, id: "item_1", label: "First", description: null, display_order: 0 },
  { ...rowBase, id: "item_2", label: "Second", description: null, display_order: 1 },
  { ...rowBase, id: "item_3", label: "Third", description: null, display_order: 2 },
];

const seasonalRows = [
  { ...rowBase, id: "season_1", start_month: 5, end_month: 9, note: null },
  { ...rowBase, id: "season_2", start_month: 11, end_month: 12, note: null },
];

function noop() {}

describe("TemplateCategoryList", () => {
  it("renders a drag handle for a reorderable category", () => {
    render(<TemplateCategoryList adapter={includedItemAdapter} rows={rows} disabled={false} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onReorder={noop} />);
    expect(screen.getAllByRole("button", { name: /Reorder/ })).toHaveLength(3);
  });

  it("renders no drag handle for a category that doesn't support reordering", () => {
    render(<TemplateCategoryList adapter={seasonalWindowAdapter} rows={seasonalRows} disabled={false} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onReorder={noop} />);
    expect(screen.queryByRole("button", { name: /Reorder/ })).not.toBeInTheDocument();
  });

  it("renders no drag handle when read-only, even for a reorderable category", () => {
    render(<TemplateCategoryList adapter={includedItemAdapter} rows={rows} disabled={true} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onReorder={noop} />);
    expect(screen.queryByRole("button", { name: /Reorder/ })).not.toBeInTheDocument();
  });

  it("Move down on the first row calls onReorder with it swapped into second position", async () => {
    const user = userEvent.setup();
    const onReorder = vi.fn();
    render(<TemplateCategoryList adapter={includedItemAdapter} rows={rows} disabled={false} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onReorder={onReorder} />);
    const menus = screen.getAllByRole("button", { name: "Item actions" });
    await user.click(menus[0]);
    await user.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(onReorder).toHaveBeenCalledWith([rows[1], rows[0], rows[2]]);
  });

  it("announces the move via the polite live region", async () => {
    const user = userEvent.setup();
    render(<TemplateCategoryList adapter={includedItemAdapter} rows={rows} disabled={false} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onReorder={noop} />);
    const menus = screen.getAllByRole("button", { name: "Item actions" });
    await user.click(menus[0]);
    await user.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(screen.getByText(/Moved "First" to position 2 of 3\./)).toBeInTheDocument();
  });
});
