import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryItemForm } from "@/modules/inventory/components/InventoryItemForm";
import { makeInventoryItem } from "@/modules/inventory/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("InventoryItemForm", () => {
  it("shows a validation error for a missing name and does not submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: /create item/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a valid reusable item with a condition set", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeInventoryItem() });
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={onSubmit} showInitialQuantity />);

    await user.type(screen.getByLabelText(/^name/i), "Gold Chiavari Chair");
    await user.selectOptions(screen.getByLabelText(/item type/i), "reusable");
    await user.selectOptions(screen.getByLabelText(/condition/i), "excellent");
    await user.click(screen.getByRole("button", { name: /create item/i }));

    await screen.findByRole("button", { name: /create item/i });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Gold Chiavari Chair", item_type: "reusable", condition: "excellent" }),
    );
  });

  it("submits a valid consumable item with a null-equivalent condition", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeInventoryItem() });
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={onSubmit} showInitialQuantity />);

    await user.type(screen.getByLabelText(/^name/i), "Ivory Taper Candle");
    // item_type defaults to "consumable" — condition select should already be disabled and empty.
    await user.click(screen.getByRole("button", { name: /create item/i }));

    await screen.findByRole("button", { name: /create item/i });
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Ivory Taper Candle", item_type: "consumable", condition: "" }));
  });

  it("disables and clears the condition field when item type is consumable", async () => {
    const user = userEvent.setup();
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/item type/i), "reusable");
    await user.selectOptions(screen.getByLabelText(/condition/i), "damaged");
    expect(screen.getByLabelText(/condition/i)).toHaveValue("damaged");

    await user.selectOptions(screen.getByLabelText(/item type/i), "consumable");
    expect(screen.getByLabelText(/condition/i)).toBeDisabled();
    expect(screen.getByLabelText(/condition/i)).toHaveValue("");
  });

  it("rejects a negative reorder level", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^name/i), "Ivory Taper Candle");
    await user.type(screen.getByLabelText(/reorder level/i), "-5");
    await user.click(screen.getByRole("button", { name: /create item/i }));

    expect(await screen.findByText(/whole, non-negative number/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the initial quantity field only when showInitialQuantity is set", () => {
    const { rerender } = render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={vi.fn()} showInitialQuantity />);
    expect(screen.getByLabelText(/initial quantity/i)).toBeInTheDocument();

    rerender(<InventoryItemForm submitLabel="Save changes" cancelHref="/inventory" onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText(/initial quantity/i)).not.toBeInTheDocument();
  });

  it("shows the repository's duplicate SKU error as a field-level error", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue({
      success: false,
      error: "This SKU is already in use in this workspace.",
      fieldErrors: { sku: "This SKU is already in use in this workspace." },
    });
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^name/i), "Ivory Taper Candle");
    await user.type(screen.getByLabelText(/sku/i), "CANDLE-01");
    await user.click(screen.getByRole("button", { name: /create item/i }));

    expect(await screen.findAllByText(/already in use in this workspace/i)).not.toHaveLength(0);
  });

  it("disables the submit button while submitting to prevent double submit", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (value: { success: true; data: ReturnType<typeof makeInventoryItem> }) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<{ success: true; data: ReturnType<typeof makeInventoryItem> }>((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^name/i), "Ivory Taper Candle");
    await user.click(screen.getByRole("button", { name: /create item/i }));

    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
    resolveSubmit({ success: true, data: makeInventoryItem() });
  });
});
