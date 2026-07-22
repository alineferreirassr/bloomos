import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorDetailView } from "@/modules/vendors/components/VendorDetailView";
import { makeVendor } from "@/modules/vendors/testUtils";
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

  it("never references Inventory, Purchases, Documents, or Media", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);

    render(<VendorDetailView vendorId="vendor_1" />);

    await screen.findByRole("heading", { name: "Test Vendor Co" });
    expect(screen.queryByText(/inventory/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/purchase/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/documents/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/media/i)).not.toBeInTheDocument();
  });

  it("includes a Timeline section that renders Vendor activity", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getNotesByVendorId).mockResolvedValue([]);
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
    vi.mocked(dataLayer.getTimelineByVendorId).mockRejectedValue(new Error("boom"));

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByRole("heading", { name: "Still Visible Co" })).toBeInTheDocument();
    expect(await screen.findByText(/could not load this vendor's activity history/i)).toBeInTheDocument();
  });

  it("includes a Notes section that renders Vendor notes", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());
    vi.mocked(dataLayer.getTimelineByVendorId).mockResolvedValue([]);
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
    vi.mocked(dataLayer.getNotesByVendorId).mockRejectedValue(new Error("boom"));

    render(<VendorDetailView vendorId="vendor_test" />);

    expect(await screen.findByRole("heading", { name: "Notes Failure Co" })).toBeInTheDocument();
    expect(await screen.findByText(/could not load this vendor's notes/i)).toBeInTheDocument();
    expect(await screen.findByText("No activity yet")).toBeInTheDocument();
  });
});
