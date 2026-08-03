import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryItemForm } from "@/modules/inventory/components/InventoryItemForm";
import { makeInventoryItem } from "@/modules/inventory/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  getVendors: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("InventoryItemForm", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLayer.getVendors).mockResolvedValue([]);
  });

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

  it("looks up vendors on mount and lists them in the picker", async () => {
    vi.mocked(dataLayer.getVendors).mockResolvedValue([
      { id: "vendor_1", company_name: "Bloom & Stem Florals", display_name: null } as never,
      { id: "vendor_2", company_name: "Petal Co", display_name: "Petal" } as never,
    ]);
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={vi.fn()} />);

    expect(await screen.findByRole("option", { name: "Bloom & Stem Florals" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Petal Co (Petal)" })).toBeInTheDocument();
    expect(dataLayer.getVendors).toHaveBeenCalledWith({ includeArchived: false });
  });

  it("selects a vendor and submits its id as primary_vendor_id", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getVendors).mockResolvedValue([{ id: "vendor_1", company_name: "Bloom & Stem Florals", display_name: null } as never]);
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeInventoryItem() });
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={onSubmit} />);

    await screen.findByRole("option", { name: "Bloom & Stem Florals" });
    await user.type(screen.getByLabelText(/^name/i), "Ivory Taper Candle");
    await user.selectOptions(screen.getByLabelText(/^vendor$/i), "vendor_1");
    await user.click(screen.getByRole("button", { name: /create item/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ primary_vendor_id: "vendor_1" })));
  });

  it("clears a selected vendor back to none", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getVendors).mockResolvedValue([{ id: "vendor_1", company_name: "Bloom & Stem Florals", display_name: null } as never]);
    const onSubmit = vi.fn().mockResolvedValue({ success: true, data: makeInventoryItem() });
    render(
      <InventoryItemForm
        submitLabel="Save changes"
        cancelHref="/inventory"
        onSubmit={onSubmit}
        defaultValues={{ primary_vendor_id: "vendor_1" }}
      />,
    );

    await screen.findByRole("option", { name: "Bloom & Stem Florals" });
    expect(screen.getByLabelText(/^vendor$/i)).toHaveValue("vendor_1");

    await user.selectOptions(screen.getByLabelText(/^vendor$/i), "");
    await user.type(screen.getByLabelText(/^name/i), "Ivory Taper Candle");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ primary_vendor_id: "" })));
  });

  it("shows an inline error but keeps the form usable when vendors fail to load", async () => {
    vi.mocked(dataLayer.getVendors).mockRejectedValue(new Error("boom"));
    render(<InventoryItemForm submitLabel="Create Item" cancelHref="/inventory" onSubmit={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load vendors/i);
    expect(screen.getByLabelText(/^vendor$/i)).toBeDisabled();
  });
});
