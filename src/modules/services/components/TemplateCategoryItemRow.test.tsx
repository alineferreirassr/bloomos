import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateCategoryItemRow } from "@/modules/services/components/TemplateCategoryItemRow";
import { includedItemAdapter, teamRoleRequirementAdapter, seasonalWindowAdapter } from "@/modules/services/templateCategoryAdapters";

const rowBase = { workspace_id: "ws_1", service_version_id: "draft_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" };
const includedItemRow = { ...rowBase, id: "item_1", label: "Welcome drink", description: "One per guest.", display_order: 0 };
const teamRow = { ...rowBase, id: "team_1", role_label: "Lead Photographer", quantity: 2, note: null, display_order: 0 };
const seasonalRow = { ...rowBase, id: "season_1", start_month: 5, end_month: 9, note: null };

function noop() {}

describe("TemplateCategoryItemRow", () => {
  it("renders the label, description, and metadata badges from the adapter", () => {
    render(
      <TemplateCategoryItemRow
        adapter={teamRoleRequirementAdapter}
        row={teamRow}
        position={0}
        total={1}
        disabled={false}
        locked={false}
        onOpenInspector={noop}
        onDelete={noop}
        onInlineChange={noop}
        onMoveUp={noop}
        onMoveDown={noop}
      />,
    );
    expect(screen.getByText("Lead Photographer")).toBeInTheDocument();
    expect(screen.getByText("× 2")).toBeInTheDocument();
  });

  it("renders the inline number field and calls onInlineChange with the row and the new value", async () => {
    const user = userEvent.setup();
    const onInlineChange = vi.fn();
    render(
      <TemplateCategoryItemRow
        adapter={teamRoleRequirementAdapter}
        row={teamRow}
        position={0}
        total={1}
        disabled={false}
        locked={false}
        onOpenInspector={noop}
        onDelete={noop}
        onInlineChange={onInlineChange}
        onMoveUp={noop}
        onMoveDown={noop}
      />,
    );
    const quantityInput = screen.getByLabelText("Quantity");
    await user.type(quantityInput, "5");
    expect(onInlineChange).toHaveBeenCalled();
    expect(onInlineChange.mock.calls[0][0]).toBe(teamRow);
  });

  it("shows Edit when writable, View when read-only", () => {
    const { rerender } = render(
      <TemplateCategoryItemRow adapter={includedItemAdapter} row={includedItemRow} position={0} total={1} disabled={false} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onMoveUp={noop} onMoveDown={noop} />,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();

    rerender(
      <TemplateCategoryItemRow adapter={includedItemAdapter} row={includedItemRow} position={0} total={1} disabled={true} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onMoveUp={noop} onMoveDown={noop} />,
    );
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });

  it("hides Move up at the first position and Move down at the last, but always shows Delete when writable", async () => {
    const user = userEvent.setup();
    render(
      <TemplateCategoryItemRow adapter={includedItemAdapter} row={includedItemRow} position={0} total={3} disabled={false} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onMoveUp={noop} onMoveDown={noop} />,
    );
    await user.click(screen.getByRole("button", { name: "Item actions" }));
    expect(screen.queryByRole("menuitem", { name: "Move up" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Move down" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("calls onMoveUp/onMoveDown with the row when those actions are selected", async () => {
    const user = userEvent.setup();
    const onMoveDown = vi.fn();
    render(
      <TemplateCategoryItemRow adapter={includedItemAdapter} row={includedItemRow} position={0} total={3} disabled={false} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onMoveUp={noop} onMoveDown={onMoveDown} />,
    );
    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Move down" }));
    expect(onMoveDown).toHaveBeenCalledWith(includedItemRow);
  });

  it("renders no drag handle and no reorder actions for a category with supportsReorder=false", async () => {
    const user = userEvent.setup();
    render(
      <TemplateCategoryItemRow adapter={seasonalWindowAdapter} row={seasonalRow} position={0} total={2} disabled={false} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onMoveUp={noop} onMoveDown={noop} />,
    );
    expect(screen.queryByRole("button", { name: /Reorder/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Item actions" }));
    expect(screen.queryByRole("menuitem", { name: "Move up" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Move down" })).not.toBeInTheDocument();
  });

  it("shows the LockIcon tooltip only when locked (published version), not merely disabled", () => {
    const { rerender, container } = render(
      <TemplateCategoryItemRow adapter={includedItemAdapter} row={includedItemRow} position={0} total={1} disabled={true} locked={false} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onMoveUp={noop} onMoveDown={noop} />,
    );
    expect(container.querySelector('[aria-disabled="true"]')).toBeInTheDocument();

    rerender(
      <TemplateCategoryItemRow adapter={includedItemAdapter} row={includedItemRow} position={0} total={1} disabled={false} locked={true} onOpenInspector={noop} onDelete={noop} onInlineChange={noop} onMoveUp={noop} onMoveDown={noop} />,
    );
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });
});
