import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VendorsListView } from "@/modules/vendors/components/VendorsListView";
import { makeVendor } from "@/modules/vendors/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  getVendors: vi.fn(),
  archiveVendor: vi.fn(),
  restoreVendor: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("VendorsListView", () => {
  it("shows a loading state, then the vendor list", async () => {
    vi.mocked(dataLayer.getVendors).mockResolvedValue([makeVendor({ company_name: "Bloom & Stem Florals" })]);

    render(<VendorsListView />);

    expect((await screen.findAllByText("Bloom & Stem Florals")).length).toBeGreaterThan(0);
  });

  it("shows an empty state with a New Vendor call-to-action when there are no vendors", async () => {
    vi.mocked(dataLayer.getVendors).mockResolvedValue([]);

    render(<VendorsListView />);

    expect(await screen.findByText(/no vendors yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /new vendor/i }).length).toBeGreaterThan(0);
  });

  it("shows an error state with a retry action when loading fails", async () => {
    vi.mocked(dataLayer.getVendors).mockRejectedValue(new Error("boom"));

    render(<VendorsListView />);

    expect(await screen.findByText(/could not load vendors/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("re-queries with the search term when the search input changes", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getVendors).mockResolvedValue([]);

    render(<VendorsListView />);
    await screen.findByText(/no vendors yet/i);

    await user.type(screen.getByLabelText(/search vendors/i), "Bloom");

    await waitFor(() =>
      expect(dataLayer.getVendors).toHaveBeenLastCalledWith(expect.objectContaining({ search: "Bloom" }), expect.anything()),
    );
  });

  it("re-queries with the status filter when changed", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getVendors).mockResolvedValue([]);

    render(<VendorsListView />);
    await screen.findByText(/no vendors yet/i);

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "inactive");

    await waitFor(() =>
      expect(dataLayer.getVendors).toHaveBeenLastCalledWith(expect.objectContaining({ status: "inactive" }), expect.anything()),
    );
  });

  it("re-queries with includeArchived when the archived checkbox is toggled", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.getVendors).mockResolvedValue([]);

    render(<VendorsListView />);
    await screen.findByText(/no vendors yet/i);

    await user.click(screen.getByLabelText(/show archived vendors/i));

    await waitFor(() =>
      expect(dataLayer.getVendors).toHaveBeenLastCalledWith(expect.objectContaining({ includeArchived: true }), expect.anything()),
    );
  });

  it("links to /vendors/new", async () => {
    vi.mocked(dataLayer.getVendors).mockResolvedValue([makeVendor()]);

    render(<VendorsListView />);
    await screen.findAllByText("Test Vendor Co");

    const newVendorLinks = screen.getAllByRole("link", { name: /new vendor/i });
    expect(newVendorLinks[0]).toHaveAttribute("href", "/vendors/new");
  });
});
