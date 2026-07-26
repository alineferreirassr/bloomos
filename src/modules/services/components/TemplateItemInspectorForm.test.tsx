import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateItemInspectorForm } from "@/modules/services/components/TemplateItemInspectorForm";
import { ServiceMutationError } from "@/modules/services/hooks/errorContract";
import { includedItemAdapter } from "@/modules/services/templateCategoryAdapters";

const row = { id: "item_1", workspace_id: "ws_1", service_version_id: "draft_1", label: "Welcome drink", description: "One per guest.", display_order: 0, created_at: "", updated_at: "" };

interface RenderFormOverrides {
  row?: typeof row | null;
  onSave?: (input: { label: string; description: string | null }) => Promise<unknown>;
  readOnly?: boolean;
  readOnlyReason?: string;
}

// `Parameters<typeof TemplateItemInspectorForm>[0]` would collapse the
// component's generic `TRow`/`TInput` to their bare constraints — this
// explicit override type sidesteps that TS quirk for a generic component.
function renderForm(overrides: RenderFormOverrides = {}) {
  const onSave = overrides.onSave ?? vi.fn().mockResolvedValue(row);
  const onCancel = vi.fn();
  const onDirtyChange = vi.fn();
  const utils = render(
    <TemplateItemInspectorForm
      adapter={includedItemAdapter}
      row={overrides.row === undefined ? row : overrides.row}
      onSave={onSave}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
      readOnly={overrides.readOnly ?? false}
      readOnlyReason={overrides.readOnlyReason}
    />,
  );
  return { onSave, onCancel, onDirtyChange, ...utils };
}

describe("TemplateItemInspectorForm", () => {
  it("renders one input per adapter field, pre-filled from the row", () => {
    renderForm();
    expect(screen.getByLabelText("Label", { exact: false })).toHaveValue("Welcome drink");
    expect(screen.getByLabelText("Description")).toHaveValue("One per guest.");
  });

  it("reports dirty once a field changes, and clean initially", async () => {
    const user = userEvent.setup();
    const { onDirtyChange } = renderForm();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    await user.type(screen.getByLabelText("Label", { exact: false }), "!");
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it("calls onSave with the converted input on submit", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();
    await user.clear(screen.getByLabelText("Label", { exact: false }));
    await user.type(screen.getByLabelText("Label", { exact: false }), "New label");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith({ label: "New label", description: "One per guest." });
  });

  it("shows a field-level error mapped from the mutation's fieldErrors", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new ServiceMutationError("Please fix the highlighted fields.", { label: "Label is required" }));
    renderForm({ onSave });
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Label is required")).toBeInTheDocument();
  });

  it("disables every field and shows a Tooltip-explained disabled Save when read-only", () => {
    renderForm({ readOnly: true, readOnlyReason: "Archived Services are read-only. Restore it first." });
    expect(screen.getByLabelText("Label", { exact: false })).toBeDisabled();
    expect(screen.getByText("Archived Services are read-only. Restore it first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true");
  });
});
