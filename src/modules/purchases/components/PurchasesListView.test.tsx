import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchasesListView } from "@/modules/purchases/components/PurchasesListView";
import { makePurchase } from "@/modules/purchases/testUtils";
import { makeVendor } from "@/modules/vendors/testUtils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/lib/data", () => ({
  listPurchases: vi.fn(),
  getOpenPurchases: vi.fn(),
  getOverduePurchases: vi.fn(),
  getVendors: vi.fn(),
  archivePurchase: vi.fn(),
  restorePurchase: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

describe("PurchasesListView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dataLayer.getOverduePurchases).mockResolvedValue([]);
    vi.mocked(dataLayer.getVendors).mockResolvedValue([]);
  });

  it("shows a loading state, then the populated list", async () => {
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([makePurchase({ purchase_number: "PO-2026-0001" })]);

    render(<PurchasesListView />);

    expect((await screen.findAllByText("PO-2026-0001")).length).toBeGreaterThan(0);
  });

  it("shows an empty state with a New Purchase call-to-action when there are no purchases", async () => {
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([]);

    render(<PurchasesListView />);

    expect(await screen.findByText(/no purchases yet/i)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /new purchase/i }).length).toBeGreaterThan(0);
  });

  it("shows an error state with a retry action when loading fails", async () => {
    vi.mocked(dataLayer.listPurchases).mockRejectedValue(new Error("boom"));

    render(<PurchasesListView />);

    expect(await screen.findByText(/^could not load purchases\.$/i)).toBeInTheDocument();
    // The summary section above the list independently calls listPurchases too, so it also
    // renders its own retry button when the mock rejects — assert at least one exists, not exactly one.
    expect(screen.getAllByRole("button", { name: /try again/i }).length).toBeGreaterThan(0);
  });

  it("re-queries with the search term when the search input changes", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([]);

    render(<PurchasesListView />);
    await screen.findByText(/no purchases yet/i);

    await user.type(screen.getByLabelText(/search purchases/i), "PO-2026");

    await waitFor(() => expect(dataLayer.listPurchases).toHaveBeenLastCalledWith(expect.objectContaining({ search: "PO-2026" })));
  });

  it("re-queries with the status filter when changed", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([]);

    render(<PurchasesListView />);
    await screen.findByText(/no purchases yet/i);

    await user.selectOptions(screen.getByLabelText(/filter by status/i), "submitted");

    await waitFor(() => expect(dataLayer.listPurchases).toHaveBeenLastCalledWith(expect.objectContaining({ status: "submitted" })));
  });

  it("re-queries with includeArchived when the archived checkbox is toggled", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([]);

    render(<PurchasesListView />);
    await screen.findByText(/no purchases yet/i);

    await user.click(screen.getByLabelText(/show archived purchases/i));

    await waitFor(() => expect(dataLayer.listPurchases).toHaveBeenLastCalledWith(expect.objectContaining({ includeArchived: true })));
  });

  it("calls getOpenPurchases instead of listPurchases when Open only is checked", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([]);
    vi.mocked(dataLayer.getOpenPurchases).mockResolvedValue([makePurchase({ status: "submitted" })]);

    render(<PurchasesListView />);
    await screen.findByText(/no purchases yet/i);

    await user.click(screen.getByLabelText(/open only/i));

    await waitFor(() => expect(dataLayer.getOpenPurchases).toHaveBeenCalled());
  });

  it("calls getOverduePurchases instead of listPurchases when Overdue only is checked", async () => {
    const user = userEvent.setup();
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([]);
    vi.mocked(dataLayer.getOverduePurchases).mockResolvedValue([makePurchase({ status: "submitted", expected_delivery_date: "2020-01-01" })]);

    render(<PurchasesListView />);
    await screen.findByText(/no purchases yet/i);

    await user.click(screen.getByLabelText(/overdue only/i));

    await waitFor(() => expect(dataLayer.getOverduePurchases).toHaveBeenCalled());
  });

  it("displays the linked vendor's company name, joined client-side by vendor_id", async () => {
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([makePurchase({ vendor_id: "vendor_1" })]);
    vi.mocked(dataLayer.getVendors).mockResolvedValue([makeVendor({ id: "vendor_1", company_name: "Bloom & Stem Florals" })]);

    render(<PurchasesListView />);

    expect((await screen.findAllByText("Bloom & Stem Florals")).length).toBeGreaterThan(0);
  });

  it("displays the status badge for each purchase", async () => {
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([makePurchase({ status: "partially_received" })]);

    render(<PurchasesListView />);

    expect((await screen.findAllByText("Partially Received")).length).toBeGreaterThan(0);
  });

  it("links each purchase to its detail page and links New Purchase to /purchases/new", async () => {
    vi.mocked(dataLayer.listPurchases).mockResolvedValue([makePurchase({ id: "purchase-42", purchase_number: "PO-2026-0042" })]);

    render(<PurchasesListView />);
    const links = await screen.findAllByRole("link", { name: "PO-2026-0042" });
    expect(links[0]).toHaveAttribute("href", "/purchases/purchase-42");

    const newPurchaseLinks = screen.getAllByRole("link", { name: /new purchase/i });
    expect(newPurchaseLinks[0]).toHaveAttribute("href", "/purchases/new");
  });
});
