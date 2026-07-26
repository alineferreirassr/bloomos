import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceIdentityForm } from "@/modules/services/components/ServiceIdentityForm";
import { ServiceMutationError } from "@/modules/services/hooks/errorContract";
import { makeService, makeServiceCategory } from "@/modules/services/testUtils";

function renderForm(overrides: Partial<Parameters<typeof ServiceIdentityForm>[0]> = {}) {
  const onSave = vi.fn().mockResolvedValue(makeService());
  const categories = [makeServiceCategory()];
  const utils = render(
    <ServiceIdentityForm service={makeService()} categories={categories} onSave={onSave} readOnly={false} {...overrides} />,
  );
  return { onSave, ...utils };
}

describe("ServiceIdentityForm", () => {
  it("renders view mode by default with name/category/description", () => {
    renderForm();
    expect(screen.getByText("Live Music")).toBeInTheDocument();
    expect(screen.getByText("Music")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("enters edit mode on Edit and moves focus to the Name field", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Name", { exact: false })).toHaveFocus();
  });

  it("cancel restores the last confirmed server values and returns focus to Edit", async () => {
    const user = userEvent.setup();
    renderForm();
    const editButton = screen.getByRole("button", { name: "Edit" });
    await user.click(editButton);
    await user.clear(screen.getByLabelText("Name", { exact: false }));
    await user.type(screen.getByLabelText("Name", { exact: false }), "Something Else");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Live Music")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveFocus();
  });

  it("successful save calls onSave with the converted ServiceInput and exits edit mode", async () => {
    const user = userEvent.setup();
    const { onSave } = renderForm();
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Name", { exact: false }));
    await user.type(screen.getByLabelText("Name", { exact: false }), "New Name");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ category_id: "cat_1", name: "New Name", description: null }));
    expect(await screen.findByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows a field-level validation error and keeps the form open on failed save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new ServiceMutationError("Please fix the highlighted fields.", { name: "Name is required" }));
    renderForm({ onSave });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(screen.getByLabelText("Name", { exact: false })).toBeInTheDocument();
  });

  it("surfaces a non-field repository error through the mutation hook's error contract", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new ServiceMutationError("An archived Service cannot be edited. Restore it first."));
    renderForm({ onSave });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("An archived Service cannot be edited. Restore it first.");
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("shows a disabled Edit button with a Tooltip explanation when read-only", async () => {
    renderForm({ readOnly: true, readOnlyReason: "Archived Services are read-only. Restore it first." });
    const editButton = screen.getByRole("button", { name: "Edit" });
    expect(editButton).toHaveAttribute("aria-disabled", "true");
  });
});
