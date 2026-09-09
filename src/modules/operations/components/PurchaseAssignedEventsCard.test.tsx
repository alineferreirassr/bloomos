import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PurchaseAssignedEventsCard } from "@/modules/operations/components/PurchaseAssignedEventsCard";
import { makeEvent } from "@/modules/events/testUtils";

vi.mock("@/modules/operations/purchaseOperationsData", () => ({
  getPurchaseAssignedEvents: vi.fn(),
}));

import { getPurchaseAssignedEvents } from "@/modules/operations/purchaseOperationsData";

afterEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseAssignedEventsCard", () => {
  it("does not render assigned-event content before data resolves", () => {
    vi.mocked(getPurchaseAssignedEvents).mockReturnValue(new Promise(() => {}));

    render(<PurchaseAssignedEventsCard purchaseId="purchase_1" />);

    expect(screen.queryByText("Assigned Event")).not.toBeInTheDocument();
  });

  it("shows the empty-state copy when the purchase isn't linked to any event", async () => {
    vi.mocked(getPurchaseAssignedEvents).mockResolvedValue([]);

    render(<PurchaseAssignedEventsCard purchaseId="purchase_1" />);

    expect(await screen.findByText("Not linked to a specific event's purchase requirement.")).toBeInTheDocument();
  });

  it("renders the assigned event with a link to its detail page", async () => {
    vi.mocked(getPurchaseAssignedEvents).mockResolvedValue([makeEvent({ id: "event_1", title: "Sunset Wedding" })]);

    render(<PurchaseAssignedEventsCard purchaseId="purchase_1" />);

    const link = await screen.findByRole("link", { name: "Sunset Wedding" });
    expect(link).toHaveAttribute("href", "/events/event_1");
  });
});
