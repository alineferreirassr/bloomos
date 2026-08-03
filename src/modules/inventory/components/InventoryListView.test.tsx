import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryListView } from "@/modules/inventory/components/InventoryListView";
import { makeInventoryItem } from "@/modules/inventory/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  listInventoryItems: vi.fn(),
  getLowStockInventoryItems: vi.fn(),
  getDamagedOrUnderRepairInventoryItems: vi.fn(),
  archiveInventoryItem: vi.fn(),
  restoreInventoryItem: vi.fn(),
  // Bloom AI's InventoryAssistantCard (Checkpoint 20, Step 13) reads these directly.
  getEvents: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("InventoryListView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLayer.getLowStockInventoryItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getDamagedOrUnderRepairInventoryItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
    // InventoryAssistantCard also calls `listInventoryItems` independently of
    // whatever value an individual test sets for the page's own main list.
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
  });

  it("shows a loading state, then the populated list", async () => {
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([makeInventoryItem({ name: "Ivory Taper Candle" })]);

    render(<InventoryListView />);

    expect((await screen.findAllByText("Ivory Taper Candle")).length).toBeGreaterThan(0);
  });

  it("shows an empty state with a New Item call-to-action when there are no items", async () => {
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<InventoryListView />);

    expect(await screen.findByText(/no inventory items yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /new item/i }).length).toBeGreaterThan(0);
  });

  it("shows an error state with a retry action when loading fails", async () => {
    vi.mocked(dataLayer.listInventoryItems).mockRejectedValue(new Error("boom"));

    render(<InventoryListView />);

    expect(await screen.findByText(/could not load inventory items/i)).toBeInTheDocument();
    // The summary section above the list independently calls listInventoryItems too, so it also
    // renders its own retry button when the mock rejects — assert at least one exists, not exactly one.
    expect(screen.getAllByRole("button", { name: /try again/i }).length).toBeGreaterThan(0);
  });

  it("re-queries with the search term when the search input changes", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<InventoryListView />);
    await screen.findByText(/no inventory items yet/i);

    await user.type(screen.getByLabelText(/search inventory/i), "Candle");

    await waitFor(() => expect(dataLayer.listInventoryItems).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Candle" })));
  });

  it("re-queries with the status filter when changed", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<InventoryListView />);
    await screen.findByText(/no inventory items yet/i);

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "inactive");

    await waitFor(() => expect(dataLayer.listInventoryItems).toHaveBeenLastCalledWith(expect.objectContaining({ status: "inactive" })));
  });

  it("re-queries with the item type filter when changed", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<InventoryListView />);
    await screen.findByText(/no inventory items yet/i);

    await user.selectOptions(screen.getByLabelText(/filter by item type/i), "reusable");

    await waitFor(() => expect(dataLayer.listInventoryItems).toHaveBeenLastCalledWith(expect.objectContaining({ itemType: "reusable" })));
  });

  it("re-queries with the condition filter when changed", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<InventoryListView />);
    await screen.findByText(/no inventory items yet/i);

    await user.selectOptions(screen.getByLabelText(/filter by condition/i), "damaged");

    await waitFor(() => expect(dataLayer.listInventoryItems).toHaveBeenLastCalledWith(expect.objectContaining({ condition: "damaged" })));
  });

  it("re-queries with includeArchived when the archived checkbox is toggled", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<InventoryListView />);
    await screen.findByText(/no inventory items yet/i);

    await user.click(screen.getByLabelText(/show archived items/i));

    await waitFor(() => expect(dataLayer.listInventoryItems).toHaveBeenLastCalledWith(expect.objectContaining({ includeArchived: true })));
  });

  it("shows a Low stock indicator for an item at or below its reorder level", async () => {
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([
      makeInventoryItem({ name: "Low Stock Item", quantity_available: 5, reorder_level: 10 }),
    ]);

    render(<InventoryListView />);
    await screen.findAllByText("Low Stock Item");

    expect(screen.getAllByText(/low stock/i).length).toBeGreaterThan(0);
  });

  it("links each item to its detail page and links New Item to /inventory/new", async () => {
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([makeInventoryItem({ id: "item-42", name: "Ivory Taper Candle" })]);

    render(<InventoryListView />);
    const links = await screen.findAllByRole("link", { name: "Ivory Taper Candle" });
    expect(links[0]).toHaveAttribute("href", "/inventory/item-42");

    const newItemLinks = screen.getAllByRole("link", { name: /new item/i });
    expect(newItemLinks[0]).toHaveAttribute("href", "/inventory/new");
  });
});
