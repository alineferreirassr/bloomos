import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchaseDetailView } from "@/modules/purchases/components/PurchaseDetailView";
import { makePurchase, makePurchaseItem } from "@/modules/purchases/testUtils";
import { makeVendor } from "@/modules/vendors/testUtils";
import { NotFoundError } from "@/core/errors";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  getPurchase: vi.fn(),
  listPurchaseItems: vi.fn(),
  getPurchaseReceiptSummary: vi.fn(),
  submitPurchase: vi.fn(),
  cancelPurchase: vi.fn(),
  archivePurchase: vi.fn(),
  restorePurchase: vi.fn(),
  addPurchaseItem: vi.fn(),
  updatePurchaseItem: vi.fn(),
  removePurchaseItem: vi.fn(),
  receivePurchaseItem: vi.fn(),
  listInventoryItems: vi.fn(),
  getNotesByPurchaseId: vi.fn(),
  createPurchaseNote: vi.fn(),
  updatePurchaseNote: vi.fn(),
  togglePurchaseNotePin: vi.fn(),
  getTimelineByPurchaseId: vi.fn(),
  getMediaAssetsByOwner: vi.fn(),
  uploadMediaAsset: vi.fn(),
  getMediaAssetDownloadUrl: vi.fn(),
  deleteMediaAsset: vi.fn(),
  restoreMediaAsset: vi.fn(),
  getVendorById: vi.fn(),
  // PurchaseAssignedEventsCard (Checkpoint 21, Step 8) reads these directly.
  getEvents: vi.fn(),
  listEventServicesByEvent: vi.fn(),
  listEventServicePurchaseRequirements: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const RECEIPT_SUMMARY = { totalOrdered: 0, totalReceived: 0, isFullyReceived: false, isPartiallyReceived: false };

describe("PurchaseDetailView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLayer.listPurchaseItems).mockResolvedValue([]);
    vi.mocked(dataLayer.getPurchaseReceiptSummary).mockResolvedValue(RECEIPT_SUMMARY);
    vi.mocked(dataLayer.getNotesByPurchaseId).mockResolvedValue([]);
    vi.mocked(dataLayer.getTimelineByPurchaseId).mockResolvedValue([]);
    vi.mocked(dataLayer.getMediaAssetsByOwner).mockResolvedValue([]);
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor({ id: "vendor-1", company_name: "Bloom & Stem Florals" }));
    vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  });

  it("shows a not-found state for a missing purchase", async () => {
    vi.mocked(dataLayer.getPurchase).mockRejectedValue(new NotFoundError("nope"));

    render(<PurchaseDetailView purchaseId="missing" />);

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });

  it("shows an error state with retry for an unexpected failure", async () => {
    vi.mocked(dataLayer.getPurchase).mockRejectedValue(new Error("boom"));

    render(<PurchaseDetailView purchaseId="purchase-1" />);

    expect(await screen.findByText(/could not load this purchase/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("displays the totals breakdown", async () => {
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(
      makePurchase({ subtotal_minor: 10000, tax_minor: 500, shipping_minor: 1000, discount_minor: 0, total_minor: 11500 }),
    );

    render(<PurchaseDetailView purchaseId="purchase-1" />);

    await screen.findByRole("heading", { name: "PO-2026-0001" });
    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("$5.00")).toBeInTheDocument();
    expect(screen.getByText("$10.00")).toBeInTheDocument();
    expect(screen.getByText("$115.00")).toBeInTheDocument();
  });

  it("displays the receipt progress summary derived from getPurchaseReceiptSummary", async () => {
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase({ status: "partially_received" }));
    vi.mocked(dataLayer.getPurchaseReceiptSummary).mockResolvedValue({
      totalOrdered: 10,
      totalReceived: 4,
      isFullyReceived: false,
      isPartiallyReceived: true,
    });

    render(<PurchaseDetailView purchaseId="purchase-1" />);

    await screen.findByRole("heading", { name: "PO-2026-0001" });
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("shows the linked vendor's name and a link to its detail page", async () => {
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase({ vendor_id: "vendor-1" }));

    render(<PurchaseDetailView purchaseId="purchase-1" />);
    await screen.findByRole("heading", { name: "PO-2026-0001" });

    const link = await screen.findByRole("link", { name: "Bloom & Stem Florals" });
    expect(link).toHaveAttribute("href", "/vendors/vendor-1");
  });

  it("links an Inventory-linked line item to its Inventory detail page", async () => {
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase({ status: "draft" }));
    vi.mocked(dataLayer.listPurchaseItems).mockResolvedValue([
      makePurchaseItem({ inventory_item_id: "inv-1", name: "White Pillar Candles" }),
    ]);

    render(<PurchaseDetailView purchaseId="purchase-1" />);

    const link = await screen.findByRole("link", { name: "White Pillar Candles" });
    expect(link).toHaveAttribute("href", "/inventory/inv-1");
  });

  it("shows Submit, Cancel, and Archive for a draft purchase — the transition table allows draft to move directly to any of the three", async () => {
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase({ status: "draft" }));

    render(<PurchaseDetailView purchaseId="purchase-1" />);

    expect(await screen.findByRole("button", { name: /submit/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
  });

  it("shows Cancel and Archive but not Submit for a submitted purchase", async () => {
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase({ status: "submitted" }));

    render(<PurchaseDetailView purchaseId="purchase-1" />);

    expect(await screen.findByRole("button", { name: /^cancel$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^archive$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit/i })).not.toBeInTheDocument();
  });

  it("shows only Restore for an archived purchase", async () => {
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase({ status: "archived", archived_at: "2026-02-01T00:00:00.000Z" }));

    render(<PurchaseDetailView purchaseId="purchase-1" />);

    expect(await screen.findByRole("button", { name: /restore/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^cancel$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("archives the purchase after confirming in the modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase({ status: "draft" }));
    vi.mocked(dataLayer.archivePurchase).mockResolvedValue({ success: true, data: makePurchase({ status: "archived" }) });

    render(<PurchaseDetailView purchaseId="purchase-1" />);
    await screen.findByRole("button", { name: /^archive$/i });

    await user.click(screen.getByRole("button", { name: /^archive$/i }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/hidden from the active purchases list/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^archive$/i }));
    expect(dataLayer.archivePurchase).toHaveBeenCalledWith("purchase-1");
  });

  it("restores an archived purchase immediately, without a confirmation modal", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase({ status: "archived", archived_at: "2026-02-01T00:00:00.000Z" }));
    vi.mocked(dataLayer.restorePurchase).mockResolvedValue({ success: true, data: makePurchase({ status: "draft", archived_at: null }) });

    render(<PurchaseDetailView purchaseId="purchase-1" />);
    await user.click(await screen.findByRole("button", { name: /restore/i }));

    expect(dataLayer.restorePurchase).toHaveBeenCalledWith("purchase-1");
  });

  it("renders the Notes, Timeline, Documents, and line-item sections", async () => {
    vi.mocked(dataLayer.getPurchase).mockResolvedValue(makePurchase());

    render(<PurchaseDetailView purchaseId="purchase-1" />);
    await screen.findByRole("heading", { name: "PO-2026-0001" });

    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Line items" })).toBeInTheDocument();
  });
});
