import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorDetailView } from "@/modules/vendors/components/VendorDetailView";
import { makeVendor } from "@/modules/vendors/testUtils";
import { NotFoundError } from "@/core/errors";

vi.mock("@/lib/data", () => ({
  getVendorById: vi.fn(),
  archiveVendor: vi.fn(),
  restoreVendor: vi.fn(),
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

  it("never references Inventory or Purchases", async () => {
    vi.mocked(dataLayer.getVendorById).mockResolvedValue(makeVendor());

    render(<VendorDetailView vendorId="vendor_1" />);

    await screen.findByRole("heading", { name: "Test Vendor Co" });
    expect(screen.queryByText(/inventory/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/purchase/i)).not.toBeInTheDocument();
  });
});
