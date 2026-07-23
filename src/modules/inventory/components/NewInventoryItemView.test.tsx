import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewInventoryItemView } from "@/modules/inventory/components/NewInventoryItemView";
import { makeInventoryItem } from "@/modules/inventory/testUtils";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("@/lib/data", () => ({
  createInventoryItem: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("NewInventoryItemView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("creates the item with the entered initial quantity and navigates to its detail page", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.createInventoryItem).mockResolvedValue({ success: true, data: makeInventoryItem({ id: "item-99" }) });

    render(<NewInventoryItemView />);

    await user.type(screen.getByLabelText(/^name/i), "Ivory Taper Candle");
    await user.clear(screen.getByLabelText(/initial quantity/i));
    await user.type(screen.getByLabelText(/initial quantity/i), "40");
    await user.click(screen.getByRole("button", { name: /create item/i }));

    await screen.findByRole("button", { name: /create item/i });
    expect(dataLayer.createInventoryItem).toHaveBeenCalledWith(expect.objectContaining({ name: "Ivory Taper Candle", initial_quantity: 40 }));
    expect(push).toHaveBeenCalledWith("/inventory/item-99");
  });

  it("surfaces a duplicate SKU error without navigating", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.createInventoryItem).mockResolvedValue({
      success: false,
      error: "This SKU is already in use in this workspace.",
      fieldErrors: { sku: "This SKU is already in use in this workspace." },
    });

    render(<NewInventoryItemView />);

    await user.type(screen.getByLabelText(/^name/i), "Ivory Taper Candle");
    await user.type(screen.getByLabelText(/sku/i), "CANDLE-01");
    await user.click(screen.getByRole("button", { name: /create item/i }));

    expect(await screen.findAllByText(/already in use in this workspace/i)).not.toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });
});
