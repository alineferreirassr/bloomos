import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InventoryItemDetailView } from "@/modules/inventory/components/InventoryItemDetailView";
import { makeInventoryItem } from "@/modules/inventory/testUtils";
import { makeVendor } from "@/modules/vendors/testUtils";
import { NotFoundError } from "@/core/errors";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  getInventoryItem: vi.fn(),
  archiveInventoryItem: vi.fn(),
  restoreInventoryItem: vi.fn(),
  recordInventoryMovement: vi.fn(),
  listInventoryMovements: vi.fn(),
  getNotesByInventoryItemId: vi.fn(),
  createInventoryItemNote: vi.fn(),
  updateInventoryItemNote: vi.fn(),
  toggleInventoryItemNotePin: vi.fn(),
  getTimelineByInventoryItemId: vi.fn(),
  getMediaAssetsByOwner: vi.fn(),
  uploadMediaAsset: vi.fn(),
  getMediaAssetDownloadUrl: vi.fn(),
  deleteMediaAsset: vi.fn(),
  restoreMediaAsset: vi.fn(),
  getVendorById: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("InventoryItemDetailView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLayer.listInventoryMovements).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByInventoryItemId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByInventoryItemId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
  });

  it("shows a not-found state for a missing item", async () => {
    vi.mocked(dataLayer.getInventoryItem).mockRejectedValue(new NotFoundError("nope"));

    render(<InventoryItemDetailView inventoryItemId="missing" />);

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });

  it("shows an error state with retry for an unexpected failure", async () => {
    vi.mocked(dataLayer.getInventoryItem).mockRejectedValue(new Error("boom"));

    render(<InventoryItemDetailView inventoryItemId="item-1" />);

    expect(await screen.findByText(/could not load this inventory item/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("displays identity, classification, and quantity metadata", async () => {
    vi.mocked(dataLayer.getInventoryItem).mockResolvedValue(
      makeInventoryItem({
        name: "Ivory Taper Candle",
        sku: "CANDLE-01",
        quantity_on_hand: 100,
        quantity_available: 80,
        quantity_reserved: 17,
        reorder_level: 30,
      }),
    );

    render(<InventoryItemDetailView inventoryItemId="item-1" />);

    expect(await screen.findByRole("heading", { name: "Ivory Taper Candle" })).toBeInTheDocument();
    expect(screen.getByText(/sku: candle-01/i)).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
  });

  it("shows a Low stock badge when available quantity is at or below the reorder level", async () => {
    vi.mocked(dataLayer.getInventoryItem).mockResolvedValue(makeInventoryItem({ quantity_available: 5, reorder_level: 10 }));

    render(<InventoryItemDetailView inventoryItemId="item-1" />);

    expect(await screen.findByText(/low stock/i)).toBeInTheDocument();
  });

  it("shows Edit and Archive for an active item, and Restore for an archived item", async () => {
    vi.mocked(dataLayer.getInventoryItem).mockResolvedValue(makeInventoryItem({ archived_at: "2026-02-01T00:00:00.000Z", status: "archived" }));

    render(<InventoryItemDetailView inventoryItemId="item-1" />);

    expect(await screen.findByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("archives the item after confirming in the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getInventoryItem).mockResolvedValue(makeInventoryItem());
    vi.mocked(dataLayer.archiveInventoryItem).mockResolvedValue({ success: true, data: makeInventoryItem({ status: "archived", archived_at: "2026-02-01T00:00:00.000Z" }) });

    render(<InventoryItemDetailView inventoryItemId="item-1" />);
    await screen.findByRole("heading", { name: "Ivory Taper Candle" });

    await user.click(screen.getByRole("button", { name: "Archive" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/will be archived/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));
    expect(dataLayer.archiveInventoryItem).toHaveBeenCalledWith("item-1");
  });

  it("renders the Notes, Timeline, and Documents sections", async () => {
    vi.mocked(dataLayer.getInventoryItem).mockResolvedValue(makeInventoryItem());

    render(<InventoryItemDetailView inventoryItemId="item-1" />);
    await screen.findByRole("heading", { name: "Ivory Taper Candle" });

    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Movement history" })).toBeInTheDocument();
  });

  it("shows the linked vendor's name, company, status, and a link to its detail page", async () => {
    vi.mocked(dataLayer.getInventoryItem).mockResolvedValue(makeInventoryItem({ primary_vendor_id: "vendor_1" }));
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(
      makeVendor({ id: "vendor_1", company_name: "Bloom & Stem Florals", display_name: "Bloom & Stem", status: "active" }),
    );

    render(<InventoryItemDetailView inventoryItemId="item-1" />);
    await screen.findByRole("heading", { name: "Ivory Taper Candle" });

    const link = await screen.findByRole("link", { name: "Bloom & Stem Florals" });
    expect(link).toHaveAttribute("href", "/vendors/vendor_1");
    expect(screen.getByText("Bloom & Stem")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    expect(dataLayer.getVendorById).toHaveBeenCalledWith("vendor_1");
  });

  it('shows "No Vendor assigned." when the item has no linked vendor', async () => {
    vi.mocked(dataLayer.getInventoryItem).mockResolvedValue(makeInventoryItem({ primary_vendor_id: null }));

    render(<InventoryItemDetailView inventoryItemId="item-1" />);
    await screen.findByRole("heading", { name: "Ivory Taper Candle" });

    expect(await screen.findByText("No Vendor assigned.")).toBeInTheDocument();
    expect(dataLayer.getVendorById).not.toHaveBeenCalled();
  });

  it("shows a retryable error state when the linked vendor fails to load", async () => {
    vi.mocked(dataLayer.getInventoryItem).mockResolvedValue(makeInventoryItem({ primary_vendor_id: "vendor_1" }));
    vi.mocked(dataLayer.getVendorById).mockRejectedValue(new Error("boom"));

    render(<InventoryItemDetailView inventoryItemId="item-1" />);
    await screen.findByRole("heading", { name: "Ivory Taper Candle" });

    expect(await screen.findByText(/could not load the linked vendor/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
