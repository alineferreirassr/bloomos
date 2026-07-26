import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateInspectorDrawer } from "@/modules/services/components/TemplateInspectorDrawer";
import { includedItemAdapter } from "@/modules/services/templateCategoryAdapters";

const row = { id: "item_1", workspace_id: "ws_1", service_version_id: "draft_1", label: "Welcome drink", description: null, display_order: 0, created_at: "", updated_at: "" };

describe("TemplateInspectorDrawer", () => {
  it("shows 'Add included item' when row is null, 'Edit included item' when editing", () => {
    const { rerender } = render(<TemplateInspectorDrawer adapter={includedItemAdapter} open row={null} onClose={vi.fn()} onSave={vi.fn()} readOnly={false} />);
    expect(screen.getByRole("dialog", { name: "Add included item" })).toBeInTheDocument();

    rerender(<TemplateInspectorDrawer adapter={includedItemAdapter} open row={row} onClose={vi.fn()} onSave={vi.fn()} readOnly={false} />);
    expect(screen.getByRole("dialog", { name: "Edit included item" })).toBeInTheDocument();
  });

  it("closes directly when there are no unsaved changes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TemplateInspectorDrawer adapter={includedItemAdapter} open row={row} onClose={onClose} onSave={vi.fn()} readOnly={false} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument();
  });

  it("asks for confirmation before closing with unsaved changes, and does not close on its own", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TemplateInspectorDrawer adapter={includedItemAdapter} open row={row} onClose={onClose} onSave={vi.fn()} readOnly={false} />);
    await user.type(screen.getByLabelText("Label", { exact: false }), "!");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes only after confirming Discard", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<TemplateInspectorDrawer adapter={includedItemAdapter} open row={row} onClose={onClose} onSave={vi.fn()} readOnly={false} />);
    await user.type(screen.getByLabelText("Label", { exact: false }), "!");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes automatically after a successful Save, with no discard prompt", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(row);
    render(<TemplateInspectorDrawer adapter={includedItemAdapter} open row={row} onClose={onClose} onSave={onSave} readOnly={false} />);
    await user.type(screen.getByLabelText("Label", { exact: false }), "!");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
