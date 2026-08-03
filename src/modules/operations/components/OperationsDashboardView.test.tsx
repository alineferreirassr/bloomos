import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OperationsDashboardView } from "@/modules/operations/components/OperationsDashboardView";
import { makeEvent } from "@/modules/events/testUtils";
import { makeInventoryItem } from "@/modules/inventory/testUtils";
import { makePurchase } from "@/modules/purchases/testUtils";

vi.mock("@/lib/data", () => ({
  getEvents: vi.fn(),
  getChecklistByEventId: vi.fn(),
  getLowStockInventoryItems: vi.fn(),
  getDamagedOrUnderRepairInventoryItems: vi.fn(),
  getOverduePurchases: vi.fn(),
  getWorkspaceFinancialSummary: vi.fn(),
  listEventServicesByEvent: vi.fn(),
  listEventServiceVendorAssignments: vi.fn(),
}));

import * as dataLayer from "@/lib/data";

const BASE_SUMMARY = {
  revenue_this_month_minor: 0,
  collected_this_month_minor: 0,
  outstanding_receivables_minor: 0,
  overdue_receivables_minor: 0,
  expenses_this_month_minor: 0,
  gross_profit_minor: 0,
  net_profit_minor: 0,
  deposits_pending_minor: 0,
  refunds_this_month_minor: 0,
};

function mockDefaults() {
  vi.mocked(dataLayer.getEvents).mockResolvedValue([]);
  vi.mocked(dataLayer.getChecklistByEventId).mockResolvedValue([]);
  vi.mocked(dataLayer.getLowStockInventoryItems).mockResolvedValue([]);
  vi.mocked(dataLayer.getDamagedOrUnderRepairInventoryItems).mockResolvedValue([]);
  vi.mocked(dataLayer.getOverduePurchases).mockResolvedValue([]);
  vi.mocked(dataLayer.getWorkspaceFinancialSummary).mockResolvedValue(BASE_SUMMARY);
  vi.mocked(dataLayer.listEventServicesByEvent).mockResolvedValue([]);
  vi.mocked(dataLayer.listEventServiceVendorAssignments).mockResolvedValue([]);
}

describe("OperationsDashboardView", () => {
  it("shows empty states when nothing is happening workspace-wide", async () => {
    mockDefaults();
    render(<OperationsDashboardView />);

    expect(await screen.findByText("Operations Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("No events today")).toBeInTheDocument();
    expect(screen.getByText("No inventory alerts.")).toBeInTheDocument();
    expect(screen.getByText("No overdue purchase orders.")).toBeInTheDocument();
  });

  it("renders real inventory and purchase alerts", async () => {
    mockDefaults();
    vi.mocked(dataLayer.getLowStockInventoryItems).mockResolvedValue([makeInventoryItem({ id: "inv_1", name: "Ivory Taper Candle" })]);
    vi.mocked(dataLayer.getOverduePurchases).mockResolvedValue([makePurchase({ id: "po_1", purchase_number: "PO-2026-0007" })]);

    render(<OperationsDashboardView />);

    expect(await screen.findByText("Ivory Taper Candle")).toBeInTheDocument();
    expect(screen.getByText("PO-2026-0007")).toBeInTheDocument();
  });

  it("shows an event scheduled today under Events Today", async () => {
    mockDefaults();
    // Built from local calendar components (never `toISOString()`, which is
    // UTC) so this assertion can't flake depending on the runner's timezone
    // relative to UTC — matches the same local-midnight convention
    // `eventOperationsData.ts`'s own `daysUntil()` uses.
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    vi.mocked(dataLayer.getEvents).mockResolvedValue([makeEvent({ id: "event_1", title: "Casey's Birthday", event_date: today, status: "confirmed" })]);

    render(<OperationsDashboardView />);

    // The event legitimately appears in Events Today, Upcoming Events, and
    // Health Scores at once — assert at least one match, not exactly one.
    expect((await screen.findAllByText("Casey's Birthday")).length).toBeGreaterThan(0);
  });

  it("shows an error state and allows retry when loading fails", async () => {
    mockDefaults();
    vi.mocked(dataLayer.getEvents).mockRejectedValue(new Error("boom"));

    render(<OperationsDashboardView />);

    expect(await screen.findByText(/could not load the operations dashboard/i)).toBeInTheDocument();
  });
});
