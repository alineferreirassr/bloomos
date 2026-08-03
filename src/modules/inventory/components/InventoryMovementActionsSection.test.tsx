import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryMovementActionsSection } from "@/modules/inventory/components/InventoryMovementActionsSection";
import { makeInventoryItem } from "@/modules/inventory/testUtils";

vi.mock("@/lib/data", () => ({
  recordInventoryMovement: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("InventoryMovementActionsSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("records a movement with the entered quantity/reason and notifies the parent on success", async () => {
    const user = userEvent.setup();
    const onChanged = vi.fn();
    vi.mocked(dataLayer.recordInventoryMovement).mockResolvedValue({
      success: true,
      data: {
        id: "movement-1",
        workspace_id: "workspace-1",
        inventory_item_id: "item-1",
        movement_type: "purchase",
        quantity: 10,
        quantity_before: 100,
        quantity_after: 110,
        reason: "Restock",
        reference_type: null,
        reference_id: null,
        performed_by: "Test User",
        occurred_at: "2026-02-01T00:00:00.000Z",
        created_at: "2026-02-01T00:00:00.000Z",
      },
    });

    render(<InventoryMovementActionsSection item={makeInventoryItem({ id: "item-1" })} onChanged={onChanged} />);

    await user.click(screen.getByRole("button", { name: /receive stock/i }));
    await user.type(screen.getByLabelText(/quantity/i), "10");
    await user.type(screen.getByLabelText(/reason/i), "Restock");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(dataLayer.recordInventoryMovement).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ movement_type: "purchase", quantity: 10, reason: "Restock" }),
    );
    await vi.waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("button", { name: /confirm/i })).not.toBeInTheDocument();
  });

  it("shows the expected on-hand/available effect before confirming", async () => {
    const user = userEvent.setup();
    render(<InventoryMovementActionsSection item={makeInventoryItem({ quantity_on_hand: 100, quantity_available: 80 })} onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /receive stock/i }));
    await user.type(screen.getByLabelText(/quantity/i), "10");

    expect(screen.getByText(/100 → 110/)).toBeInTheDocument();
    expect(screen.getByText(/80 → 90/)).toBeInTheDocument();
  });

  it("rejects a zero or non-numeric quantity", async () => {
    const user = userEvent.setup();
    render(<InventoryMovementActionsSection item={makeInventoryItem()} onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /receive stock/i }));
    await user.type(screen.getByLabelText(/quantity/i), "0");

    expect(screen.getByRole("button", { name: /confirm/i })).toBeDisabled();
  });

  it("does not render any movement actions for an archived item", () => {
    render(<InventoryMovementActionsSection item={makeInventoryItem({ archived_at: "2026-02-01T00:00:00.000Z" })} onChanged={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /receive stock/i })).not.toBeInTheDocument();
    expect(screen.getByText(/can.t receive new stock movements/i)).toBeInTheDocument();
  });

  it("surfaces a repository failure inline without closing the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.recordInventoryMovement).mockResolvedValue({ success: false, error: "Quantity available cannot exceed quantity on hand." });

    render(<InventoryMovementActionsSection item={makeInventoryItem()} onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /reserve/i }));
    await user.type(screen.getByLabelText(/quantity/i), "5");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(await screen.findByText(/quantity available cannot exceed/i)).toBeInTheDocument();
  });

  it("disables the confirm button while submitting to prevent double submission", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (value: { success: true; data: unknown }) => void = () => {};
    vi.mocked(dataLayer.recordInventoryMovement).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve as typeof resolveSubmit;
        }),
    );

    render(<InventoryMovementActionsSection item={makeInventoryItem()} onChanged={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /receive stock/i }));
    await user.type(screen.getByLabelText(/quantity/i), "10");
    await user.click(screen.getByRole("button", { name: /confirm/i }));

    expect(screen.getByRole("button", { name: /recording/i })).toBeDisabled();
    resolveSubmit({ success: true, data: {} });
  });
});
