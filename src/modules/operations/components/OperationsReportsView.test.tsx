import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationsReportsView } from "@/modules/operations/components/OperationsReportsView";
import { makeEvent } from "@/modules/events/testUtils";
import { makeVendor } from "@/modules/vendors/testUtils";
import { makePurchase } from "@/modules/purchases/testUtils";
import { makeInventoryItem } from "@/modules/inventory/testUtils";

vi.mock("@/lib/data", () => ({
  getEvents: vi.fn(),
  getEventFinancialSummary: vi.fn(),
  getVendors: vi.fn(),
  getPurchasesByVendorId: vi.fn(),
  listInventoryItems: vi.fn(),
  listInventoryMovements: vi.fn(),
  listPurchases: vi.fn(),
  getWorkspaceFinancialSummary: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const SUMMARY = {
  contracted_value_minor: 0,
  invoiced_total_minor: 0,
  collected_minor: 0,
  refunded_minor: 0,
  outstanding_minor: 0,
  expense_total_minor: 0,
  gross_profit_minor: 100000,
  net_profit_minor: 80000,
  deposit_required_minor: 0,
  deposit_paid_minor: 0,
  deposit_balance_minor: 0,
  payment_completion_percentage: 0,
  expense_percentage_of_revenue: 0,
};

const WORKSPACE_SUMMARY = {
  revenue_this_month_minor: 0,
  collected_this_month_minor: 0,
  outstanding_receivables_minor: 0,
  overdue_receivables_minor: 0,
  expenses_this_month_minor: 50000,
  gross_profit_minor: 20000,
  net_profit_minor: 10000,
  deposits_pending_minor: 0,
  refunds_this_month_minor: 0,
};

function mockDefaults() {
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getEventFinancialSummary).mockResolvedValue(SUMMARY);
  vi.mocked(dataLayer.getVendors).mockResolvedValue([]);
  vi.mocked(dataLayer.getPurchasesByVendorId).mockResolvedValue([]);
  vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([]);
  vi.mocked(dataLayer.listInventoryMovements).mockResolvedValue([]);
  vi.mocked(dataLayer.listPurchases).mockResolvedValue([]);
  vi.mocked(dataLayer.getWorkspaceFinancialSummary).mockResolvedValue(WORKSPACE_SUMMARY);
}

describe("OperationsReportsView", () => {
  it("shows empty states when there's no history yet", async () => {
    mockDefaults();
    render(<OperationsReportsView />);

    expect(await screen.findByText("Operations Reports")).toBeInTheDocument();
    expect(await screen.findByText("No completed events yet")).toBeInTheDocument();
    expect(screen.getByText("No vendor purchase history yet.")).toBeInTheDocument();
  });

  it("renders real completed events and vendor performance", async () => {
    mockDefaults();
    vi.mocked(dataLayer.getEvents).mockResolvedValue([makeEvent({ id: "event_1", title: "Whitfield Anniversary", status: "completed" })]);
    vi.mocked(dataLayer.getVendors).mockResolvedValue([makeVendor({ id: "vendor_1", company_name: "Bloom & Stem Florals" })]);
    vi.mocked(dataLayer.getPurchasesByVendorId).mockResolvedValue([makePurchase({ id: "po_1", total_minor: 50000 })]);

    render(<OperationsReportsView />);

    expect(await screen.findByText("Whitfield Anniversary")).toBeInTheDocument();
    expect(await screen.findByText("Bloom & Stem Florals")).toBeInTheDocument();
  });

  it("renders real inventory usage from movement history", async () => {
    mockDefaults();
    vi.mocked(dataLayer.listInventoryItems).mockResolvedValue([makeInventoryItem({ id: "inv_1", name: "Ivory Taper Candle", quantity_reserved: 5 })]);
    vi.mocked(dataLayer.listInventoryMovements).mockResolvedValue([
      { id: "mv_1", workspace_id: "ws_1", inventory_item_id: "inv_1", movement_type: "reservation", quantity: 5, quantity_before: 10, quantity_after: 5, reason: null, reference_type: null, reference_id: null, performed_by: "user_1", occurred_at: "2026-01-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" },
    ]);

    render(<OperationsReportsView />);

    expect(await screen.findByText("Ivory Taper Candle")).toBeInTheDocument();
  });

  it("shows an error state and allows retry", async () => {
    mockDefaults();
    vi.mocked(dataLayer.getEvents).mockRejectedValue(new Error("boom"));

    render(<OperationsReportsView />);

    expect(await screen.findByText(/could not load operations reports/i)).toBeInTheDocument();
  });
});
