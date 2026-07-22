import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VendorListTable } from "@/modules/vendors/components/VendorListTable";
import { VendorListCards } from "@/modules/vendors/components/VendorListCards";
import { makeVendor } from "@/modules/vendors/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  archiveVendor: vi.fn(),
  restoreVendor: vi.fn(),
}));

const vendors = [
  makeVendor({ id: "vendor_a", company_name: "Bloom & Stem Florals", is_preferred: true, tags: ["florist"] }),
  makeVendor({ id: "vendor_b", company_name: "Candlelight Co", status: "inactive" }),
];

describe("VendorListTable (desktop)", () => {
  it("renders every vendor's company name, status, currency, and tags", () => {
    render(<VendorListTable vendors={vendors} onChanged={vi.fn()} />);
    expect(screen.getByText("Bloom & Stem Florals")).toBeInTheDocument();
    expect(screen.getByText("Candlelight Co")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
    expect(screen.getAllByText("USD")).toHaveLength(2);
    expect(screen.getByText("florist")).toBeInTheDocument();
  });

  it("marks the preferred vendor's star", () => {
    render(<VendorListTable vendors={vendors} onChanged={vi.fn()} />);
    expect(screen.getByLabelText("Preferred vendor")).toBeInTheDocument();
    expect(screen.getByLabelText("Not a preferred vendor")).toBeInTheDocument();
  });

  it("never references Inventory or Purchases", () => {
    render(<VendorListTable vendors={vendors} onChanged={vi.fn()} />);
    expect(screen.queryByText(/inventory/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/purchase/i)).not.toBeInTheDocument();
  });
});

describe("VendorListCards (mobile)", () => {
  it("renders every vendor's company name and status", () => {
    render(<VendorListCards vendors={vendors} onChanged={vi.fn()} />);
    expect(screen.getByText("Bloom & Stem Florals")).toBeInTheDocument();
    expect(screen.getByText("Candlelight Co")).toBeInTheDocument();
  });
});
