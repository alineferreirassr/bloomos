import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorOperationsCard } from "@/modules/operations/components/VendorOperationsCard";
import { makeEvent } from "@/modules/events/testUtils";
import { makePurchase } from "@/modules/purchases/testUtils";

vi.mock("@/modules/operations/vendorOperationsData", () => ({
  getVendorOperationsSummary: vi.fn(),
}));

import { getVendorOperationsSummary } from "@/modules/operations/vendorOperationsData";

afterEach(() => {
  vi.clearAllMocks();
});

describe("VendorOperationsCard", () => {
  it("does not render operations content before data resolves", () => {
    vi.mocked(getVendorOperationsSummary).mockReturnValue(new Promise(() => {}));

    render(<VendorOperationsCard vendorId="vendor_1" />);

    expect(screen.queryByText("Operations")).not.toBeInTheDocument();
  });

  it("shows empty-state copy for both sections and the fixed disclaimer", async () => {
    vi.mocked(getVendorOperationsSummary).mockResolvedValue({ assignedEvents: [], purchaseHistory: [] });

    render(<VendorOperationsCard vendorId="vendor_1" />);

    expect(await screen.findByText("No confirmed assignments to an active event.")).toBeInTheDocument();
    expect(screen.getByText("No purchase orders with this vendor yet.")).toBeInTheDocument();
    expect(
      screen.getByText("No vendor-linked Payments or Contracts, or a Rating field, exist in this codebase yet — Purchase History is the closest real proxy shown here."),
    ).toBeInTheDocument();
  });

  it("renders an assigned event with a link to its detail page", async () => {
    vi.mocked(getVendorOperationsSummary).mockResolvedValue({
      assignedEvents: [makeEvent({ id: "event_1", title: "Sunset Wedding" })],
      purchaseHistory: [],
    });

    render(<VendorOperationsCard vendorId="vendor_1" />);

    const link = await screen.findByRole("link", { name: "Sunset Wedding" });
    expect(link).toHaveAttribute("href", "/events/event_1");
  });

  it("renders purchase history with the purchase number linked to the purchase detail page and its status", async () => {
    vi.mocked(getVendorOperationsSummary).mockResolvedValue({
      assignedEvents: [],
      purchaseHistory: [makePurchase({ id: "purchase_1", purchase_number: "PO-2026-0001", status: "submitted" })],
    });

    render(<VendorOperationsCard vendorId="vendor_1" />);

    const link = await screen.findByRole("link", { name: "PO-2026-0001" });
    expect(link).toHaveAttribute("href", "/purchases/purchase_1");
    expect(screen.getByText("submitted")).toBeInTheDocument();
  });
});
