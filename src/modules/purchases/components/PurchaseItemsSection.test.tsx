import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseItemsSection } from "@/modules/purchases/components/PurchaseItemsSection";
import { makePurchase, makePurchaseItem } from "@/modules/purchases/testUtils";

vi.mock("@/lib/data", () => ({
  listInventoryItems: vi.fn(),
  addPurchaseItem: vi.fn(),
  updatePurchaseItem: vi.fn(),
  removePurchaseItem: vi.fn(),
  receivePurchaseItem: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("PurchaseItemsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("shows an Add Item button and no read-only notice for a draft purchase", () => {
    render(<PurchaseItemsSection purchase={makePurchase({ status: "draft" })} items={[]} onChanged={vi.fn()} />);

    expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
    expect(screen.queryByText(/can only be added, edited, or removed while this purchase is a draft/i)).not.toBeInTheDocument();
  });

  it("hides Add Item and shows the read-only notice once the purchase has left draft", () => {
    render(<PurchaseItemsSection purchase={makePurchase({ status: "submitted" })} items={[makePurchaseItem()]} onChanged={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /add item/i })).not.toBeInTheDocument();
    expect(screen.getByText(/can only be added, edited, or removed while this purchase is a draft/i)).toBeInTheDocument();
  });

  it("adds a non-inventory item through the modal form", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(dataLayer.addPurchaseItem).mockResolvedValue({ success: true, data: makePurchaseItem() });
    render(<PurchaseItemsSection purchase={makePurchase({ id: "purchase-1", status: "draft" })} items={[]} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /add item/i }));
    await user.type(screen.getByLabelText(/^name/i), "Rush processing fee");
    await user.clear(screen.getByLabelText(/quantity ordered/i));
    await user.type(screen.getByLabelText(/quantity ordered/i), "1");
    await user.type(screen.getByLabelText(/unit cost/i), "50");
    await user.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(dataLayer.addPurchaseItem).toHaveBeenCalledWith(
        "purchase-1",
        expect.objectContaining({ inventory_item_id: null, name: "Rush processing fee", quantity_ordered: 1, unit_cost_minor: 5000 }),
      ),
    );
    expect(onChanged).toHaveBeenCalled();
  });

  it("adds an Inventory-linked item and snapshots its name/sku/unit cost on selection", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([
      { id: "inv_1", name: "White Pillar Candles", sku: "CAN-PIL-WHT", unit_cost: 200 } as never,
    ]);
    vi.mocked(dataLayer.addPurchaseItem).mockResolvedValue({ success: true, data: makePurchaseItem({ inventory_item_id: "inv_1" }) });
    render(<PurchaseItemsSection purchase={makePurchase({ id: "purchase-1", status: "draft" })} items={[]} onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /add item/i }));
    await screen.findByRole("option", { name: /white pillar candles/i });
    await user.selectOptions(screen.getByLabelText(/inventory item/i), "inv_1");

    expect(screen.getByLabelText(/^name/i)).toHaveValue("White Pillar Candles");
    expect(screen.getByLabelText(/sku/i)).toHaveValue("CAN-PIL-WHT");
    expect(screen.getByLabelText(/unit cost/i)).toHaveValue(2);

    await user.click(screen.getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(dataLayer.addPurchaseItem).toHaveBeenCalledWith("purchase-1", expect.objectContaining({ inventory_item_id: "inv_1" })),
    );
  });

  it("edits an existing item", async () => {
    const user = userEvent.setup();
    const item = makePurchaseItem({ id: "item-1", name: "Original name" });
    vi.mocked(dataLayer.updatePurchaseItem).mockResolvedValue({ success: true, data: { ...item, name: "Updated name" } });
    render(<PurchaseItemsSection purchase={makePurchase({ status: "draft" })} items={[item]} onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /item actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    await user.clear(screen.getByLabelText(/^name/i));
    await user.type(screen.getByLabelText(/^name/i), "Updated name");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(dataLayer.updatePurchaseItem).toHaveBeenCalledWith("item-1", expect.objectContaining({ name: "Updated name" })));
  });

  it("removes a draft, unreceived item after confirming", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    const item = makePurchaseItem({ id: "item-1", quantity_received: 0 });
    vi.mocked(dataLayer.removePurchaseItem).mockResolvedValue({ success: true, data: null });
    render(<PurchaseItemsSection purchase={makePurchase({ status: "draft" })} items={[item]} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /item actions/i }));
    await user.click(screen.getByRole("menuitem", { name: /remove/i }));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(dataLayer.removePurchaseItem).toHaveBeenCalledWith("item-1"));
    expect(onChanged).toHaveBeenCalled();
  });

  it("does not offer Remove once anything has been received against the line, even while still draft — Edit remains available", async () => {
    const user = userEvent.setup();
    const item = makePurchaseItem({ quantity_received: 1 });
    render(<PurchaseItemsSection purchase={makePurchase({ status: "draft" })} items={[item]} onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /item actions/i }));
    expect(screen.getByRole("menuitem", { name: /edit/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /remove/i })).not.toBeInTheDocument();
  });

  it("shows a Receive button only for a receivable status with remaining quantity", () => {
    const item = makePurchaseItem({ quantity_ordered: 5, quantity_received: 2 });
    render(<PurchaseItemsSection purchase={makePurchase({ status: "submitted" })} items={[item]} onChanged={vi.fn()} />);

    expect(screen.getByRole("button", { name: /receive/i })).toBeInTheDocument();
  });

  it("hides the Receive button once the line has nothing remaining", () => {
    const item = makePurchaseItem({ quantity_ordered: 5, quantity_received: 5 });
    render(<PurchaseItemsSection purchase={makePurchase({ status: "submitted" })} items={[item]} onChanged={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /receive/i })).not.toBeInTheDocument();
  });

  it("hides the Receive button for a draft purchase (nothing to receive yet)", () => {
    const item = makePurchaseItem({ quantity_ordered: 5, quantity_received: 0 });
    render(<PurchaseItemsSection purchase={makePurchase({ status: "draft" })} items={[item]} onChanged={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /receive/i })).not.toBeInTheDocument();
  });

  it("displays the line subtotal as quantity × unit cost", () => {
    const item = makePurchaseItem({ quantity_ordered: 4, unit_cost_minor: 1000, line_subtotal_minor: 4000 });
    render(<PurchaseItemsSection purchase={makePurchase({ currency: "USD" })} items={[item]} onChanged={vi.fn()} />);

    expect(screen.getByText(/4 × \$10\.00 = \$40\.00/)).toBeInTheDocument();
  });
});
