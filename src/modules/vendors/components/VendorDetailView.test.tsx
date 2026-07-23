import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorDetailView } from "@/modules/vendors/components/VendorDetailView";
import { makeVendor } from "@/modules/vendors/testUtils";
import { makeInventoryItem } from "@/modules/inventory/testUtils";
import { NotFoundError } from "@/core/errors";

vi.mock("@/lib/data", () => ({
  getVendorById: vi.fn(),
  archiveVendor: vi.fn(),
  restoreVendor: vi.fn(),
  getTimelineByVendorId: vi.fn(),
  getNotesByVendorId: vi.fn(),
  createVendorNote: vi.fn(),
  updateVendorNote: vi.fn(),
  toggleVendorNotePin: vi.fn(),
  getMediaAssetsByOwner: vi.fn(),
  uploadMediaAsset: vi.fn(),
  getMediaAssetDownloadUrl: vi.fn(),
  deleteMediaAsset: vi.fn(),
  restoreMediaAsset: vi.fn(),
  listInventoryItems: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("VendorDetailView", () => {
  it("renders the vendor's company name, status, and detail fields", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(
      makeVendor({
        company_name: "Bloom & Stem Florals",
        display_name: "Bloom & Stem",
        tax_id: "TAX-10001",
        default_currency: "USD",
        tags: ["florist"],
        notes: "Preferred florist for ceremonies.",
      }),
    );
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<VendorDetailView vendorId="vendor_1" />);

    expect(await screen.findByRole("heading", { name: "Bloom & Stem Florals" })).toBeInTheDocument();
    expect(screen.getAllByText("Bloom & Stem").length).toBeGreaterThan(0);
    expect(screen.getByText("TAX-10001")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.getByText("florist")).toBeInTheDocument();
    expect(screen.getByText("Preferred florist for ceremonies.")).toBeInTheDocument();
  });

  it("shows a not-found state for a missing vendor", async () => {
    vi.mocked(dataLayer.getVendorById).mockRejectedValue(new NotFoundError("Vendor missing was not found"));

    render(<VendorDetailView vendorId="missing" />);

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });

  it("never references Purchases or Media (Inventory integration is intentional; Purchases doesn't exist yet)", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<VendorDetailView vendorId="vendor_1" />);

    await screen.findByRole("heading", { name: "Test Vendor Co" });
    expect(screen.queryByText(/purchase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\bmedia\b/i)).not.toBeInTheDocument();
  });

  it("includes a Timeline section that renders Vendor activity", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([
      {
        id: "activity_1",
        workspace_id: "ws_test",
        owner_type: "vendor",
        owner_id: "vendor_test",
        type: "vendor_created" as never,
        description: "A new vendor record",
        actor: "Amoré Bloom Team",
        timestamp: "2026-01-01T12:00:00.000Z",
      },
    ]);

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByText("Timeline")).toBeInTheDocument();
    expect(await screen.findByText("A new vendor record")).toBeInTheDocument();
  });

  it("still renders the Vendor's main details when Timeline loading fails", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor({ company_name: "Still Visible Co" }));
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByVendorId).mockRejectedValue(new Error("boom"));

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByRole("heading", { name: "Still Visible Co" })).toBeInTheDocument();
    expect(await screen.findByText(/could not load this vendor's activity history/i)).toBeInTheDocument();
  });

  it("includes a Notes section that renders Vendor notes", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([
      {
        id: "note_1",
        workspace_id: "ws_test",
        owner_type: "vendor",
        owner_id: "vendor_test",
        title: "Delivery preference",
        content: "Prefers morning deliveries.",
        category: "general",
        priority: "normal",
        is_pinned: false,
        attachments: [],
        created_by: "Amoré Bloom Team",
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:00.000Z",
      },
    ]);

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByText("Delivery preference")).toBeInTheDocument();
    expect(screen.getByText("Prefers morning deliveries.")).toBeInTheDocument();
  });

  it("still renders the Vendor's main details and Timeline when Notes loading fails", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor({ company_name: "Notes Failure Co" }));
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockRejectedValue(new Error("boom"));

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByRole("heading", { name: "Notes Failure Co" })).toBeInTheDocument();
    expect(await screen.findByText(/could not load this vendor's notes/i)).toBeInTheDocument();
    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });

  it("includes a Documents section that renders Vendor documents", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([
      {
        id: "asset_1",
        workspace_id: "ws_test",
        owner_type: "vendor",
        owner_id: "vendor_test",
        original_filename: "w9-form.pdf",
        stored_filename: "w9-form.pdf",
        storage_bucket: "media-assets",
        storage_path: "ws_test/vendor/vendor_test/asset_1/v1/w9-form.pdf",
        mime_type: "application/pdf",
        extension: "pdf",
        file_size: 204_800,
        checksum: "abc123",
        width: null,
        height: null,
        duration: null,
        version: 1,
        uploaded_by: "Amoré Bloom Team",
        created_at: "2026-01-01T12:00:00.000Z",
        updated_at: "2026-01-01T12:00:00.000Z",
        archived_at: null,
      },
    ]);

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByText("Documents")).toBeInTheDocument();
    expect(await screen.findByText("w9-form.pdf")).toBeInTheDocument();
  });

  it("still renders the Vendor's main details, Notes, and Timeline when Documents loading fails", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor({ company_name: "Documents Failure Co" }));
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockRejectedValue(new Error("boom"));

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByRole("heading", { name: "Documents Failure Co" })).toBeInTheDocument();
    expect(await screen.findByText(/could not load this vendor's documents/i)).toBeInTheDocument();
    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
    expect(await screen.findByText("No notes yet")).toBeInTheDocument();
  });

  it("includes an Inventory section that renders items sourced from this vendor", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([
      makeInventoryItem({ id: "item_1", name: "Ivory Taper Candles", sku: "CAN-01" }),
    ]);

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByText("Ivory Taper Candles")).toBeInTheDocument();
    expect(screen.getByText("CAN-01")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ivory Taper Candles" })).toHaveAttribute("href", "/inventory/item_1");
  });

  it("shows an empty state when this vendor has no inventory items", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByText(/no inventory items yet/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when the Inventory list fails to load", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor({ company_name: "Inventory Failure Co" }));
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.listInventoryItems).mockRejectedValue(new Error("boom"));

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByRole("heading", { name: "Inventory Failure Co" })).toBeInTheDocument();
    expect(await screen.findByText(/could not load inventory items for this vendor/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows a busy loading state for the Inventory section before it resolves", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    let resolveInventory: (items: ReturnType<typeof makeInventoryItem>[]) => void = () => {};
    vi.mocked(dataLayer.listInventoryItems).mockImplementation(
      () => new Promise((resolve) => { resolveInventory = resolve; }),
    );

    render(<VendorDetailView vendorId="vendor_test" />);
    await screen.findByRole("heading", { name: "Test Vendor Co" });

    expect(document.querySelectorAll('[aria-busy="true"]').length).toBeGreaterThan(0);
    resolveInventory([]);
    expect(await screen.findByText(/no inventory items yet/i)).toBeInTheDocument();
  });
});
