import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReceivePurchaseItemModal } from "@/modules/purchases/components/ReceivePurchaseItemModal";
import { makePurchaseItem } from "@/modules/purchases/testUtils";

vi.mock("@/lib/data", () => ({
  receivePurchaseItem: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("ReceivePurchaseItemModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows ordered, already received, and remaining quantities", () => {
    const item = makePurchaseItem({ quantity_ordered: 10, quantity_received: 4 });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={vi.fn()} />);

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("defaults the quantity input to the full remaining amount", () => {
    const item = makePurchaseItem({ quantity_ordered: 10, quantity_received: 4 });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={vi.fn()} />);

    expect(screen.getByLabelText(/quantity to receive/i)).toHaveValue("6");
  });

  it("receives a partial quantity and calls onReceived after success", async () => {
    const user = userEvent.setup();
    const onReceived = vi.fn();
    const item = makePurchaseItem({ id: "item-1", quantity_ordered: 10, quantity_received: 0 });
    vi.mocked(dataLayer.receivePurchaseItem).mockResolvedValue({ success: true, data: { ...item, quantity_received: 4 } });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={onReceived} />);

    await user.clear(screen.getByLabelText(/quantity to receive/i));
    await user.type(screen.getByLabelText(/quantity to receive/i), "4");
    await user.click(screen.getByRole("button", { name: /^receive$/i }));

    expect(dataLayer.receivePurchaseItem).toHaveBeenCalledWith("item-1", { quantity_received: 4, reason: null });
    expect(await screen.findByRole("button", { name: /^receive$/i })).toBeInTheDocument();
    expect(onReceived).toHaveBeenCalled();
  });

  it("receives the full remaining quantity", async () => {
    const user = userEvent.setup();
    const item = makePurchaseItem({ id: "item-1", quantity_ordered: 10, quantity_received: 6 });
    vi.mocked(dataLayer.receivePurchaseItem).mockResolvedValue({ success: true, data: { ...item, quantity_received: 10 } });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={vi.fn()} />);

    // default value is already the full remaining amount (4)
    await user.click(screen.getByRole("button", { name: /^receive$/i }));

    expect(dataLayer.receivePurchaseItem).toHaveBeenCalledWith("item-1", { quantity_received: 4, reason: null });
  });

  it("passes a trimmed reason through, or null when left blank", async () => {
    const user = userEvent.setup();
    const item = makePurchaseItem({ id: "item-1", quantity_ordered: 5, quantity_received: 0 });
    vi.mocked(dataLayer.receivePurchaseItem).mockResolvedValue({ success: true, data: { ...item, quantity_received: 5 } });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={vi.fn()} />);

    await user.type(screen.getByLabelText(/reason/i), "  Partial shipment  ");
    await user.click(screen.getByRole("button", { name: /^receive$/i }));

    expect(dataLayer.receivePurchaseItem).toHaveBeenCalledWith("item-1", { quantity_received: 5, reason: "Partial shipment" });
  });

  it("rejects a zero quantity client-side without calling the repository", async () => {
    const user = userEvent.setup();
    const item = makePurchaseItem({ quantity_ordered: 5, quantity_received: 0 });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={vi.fn()} />);

    await user.clear(screen.getByLabelText(/quantity to receive/i));
    await user.type(screen.getByLabelText(/quantity to receive/i), "0");

    // The Receive button is disabled outright for an invalid quantity — clicking a
    // disabled button is a no-op, so the repository is never even reachable.
    expect(screen.getByRole("button", { name: /^receive$/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^receive$/i }));
    expect(dataLayer.receivePurchaseItem).not.toHaveBeenCalled();
  });

  it("rejects a negative quantity client-side without calling the repository", async () => {
    const user = userEvent.setup();
    const item = makePurchaseItem({ quantity_ordered: 5, quantity_received: 0 });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={vi.fn()} />);

    await user.clear(screen.getByLabelText(/quantity to receive/i));
    await user.type(screen.getByLabelText(/quantity to receive/i), "-2");

    expect(screen.getByRole("button", { name: /^receive$/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^receive$/i }));
    expect(dataLayer.receivePurchaseItem).not.toHaveBeenCalled();
  });

  it("rejects an over-receipt (more than remaining) client-side without calling the repository", async () => {
    const user = userEvent.setup();
    const item = makePurchaseItem({ quantity_ordered: 5, quantity_received: 3 });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={vi.fn()} />);

    await user.clear(screen.getByLabelText(/quantity to receive/i));
    await user.type(screen.getByLabelText(/quantity to receive/i), "10");

    expect(screen.getByRole("button", { name: /^receive$/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /^receive$/i }));
    expect(dataLayer.receivePurchaseItem).not.toHaveBeenCalled();
  });

  it("disables the Receive button while the quantity is invalid", async () => {
    const user = userEvent.setup();
    const item = makePurchaseItem({ quantity_ordered: 5, quantity_received: 3 });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={vi.fn()} />);

    await user.clear(screen.getByLabelText(/quantity to receive/i));
    await user.type(screen.getByLabelText(/quantity to receive/i), "10");

    expect(screen.getByRole("button", { name: /^receive$/i })).toBeDisabled();
  });

  it("surfaces a repository error without closing the modal", async () => {
    const user = userEvent.setup();
    const onReceived = vi.fn();
    const item = makePurchaseItem({ id: "item-1", quantity_ordered: 5, quantity_received: 0 });
    vi.mocked(dataLayer.receivePurchaseItem).mockResolvedValue({ success: false, error: "This purchase cannot receive stock in its current status." });
    render(<ReceivePurchaseItemModal item={item} open onClose={vi.fn()} onReceived={onReceived} />);

    await user.click(screen.getByRole("button", { name: /^receive$/i }));

    expect(await screen.findByText(/cannot receive stock in its current status/i)).toBeInTheDocument();
    expect(onReceived).not.toHaveBeenCalled();
  });
});
