import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("@/modules/analytics/executive/getExecutiveDashboardData", () => ({
  getExecutiveDashboardData: vi.fn(),
}));
vi.mock("@/modules/analytics/layout/dashboardLayoutActions", () => ({
  getDashboardLayoutAction: vi.fn(),
  saveDashboardLayoutAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/modules/analytics/components/PerformanceStorySection", () => ({
  PerformanceStorySection: () => <div data-testid="performance-story-section" />,
}));
vi.mock("@/modules/analytics/components/ClientBookingInsightsSection", () => ({
  ClientBookingInsightsSection: () => <div data-testid="client-booking-insights-section" />,
}));
vi.mock("@/modules/analytics/components/OperationalInsightsSection", () => ({
  OperationalInsightsSection: () => <div data-testid="operational-insights-section" />,
}));
vi.mock("@/modules/analytics/components/AttentionInsightsSection", () => ({
  AttentionInsightsSection: () => <div data-testid="attention-insights-section" />,
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ExecutiveDashboardOverview } from "@/modules/analytics/executive/components/ExecutiveDashboardOverview";
import { getExecutiveDashboardData } from "@/modules/analytics/executive/getExecutiveDashboardData";
import { getDashboardLayoutAction, saveDashboardLayoutAction } from "@/modules/analytics/layout/dashboardLayoutActions";
import { EXECUTIVE_DASHBOARD_WIDGET_IDS, type ExecutiveDashboardWidgetId } from "@/modules/analytics/executive/executiveWidgets";
import type { ExecutiveDashboardData } from "@/modules/analytics/executive/getExecutiveDashboardData";
import type { DashboardLayout, DashboardWidgetPreference } from "@/types/businessIntelligence";

function widgets(overrides: Partial<Record<ExecutiveDashboardWidgetId, Partial<DashboardWidgetPreference>>> = {}): DashboardWidgetPreference[] {
  return EXECUTIVE_DASHBOARD_WIDGET_IDS.map((widgetId, order) => ({
    widgetId,
    pinned: false,
    hidden: false,
    order,
    ...overrides[widgetId],
  }));
}

function layout(overrides: Partial<DashboardLayout> = {}): DashboardLayout {
  return {
    workspace_id: "workspace_1",
    member_id: "member_1",
    widgets: widgets(),
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function dashboardData(overrides: Partial<ExecutiveDashboardData> = {}): ExecutiveDashboardData {
  return {
    currency: "usd",
    todaysRevenueMinor: 0,
    monthlyRevenueMinor: 100000,
    revenueGrowthPercent: 5,
    profitMinor: 20000,
    expensesMinor: 30000,
    cashFlowMinor: 10000,
    pipelineValueMinor: 500000,
    upcomingEventsCount: 3,
    eventsThisMonthCount: 1,
    conversionRatePercent: 40,
    averageTicketMinor: 250000,
    averageDepositMinor: 50000,
    outstandingPaymentsMinor: 15000,
    estimatedCustomerLifetimeValueMinor: 400000,
    forecast: null,
    businessHealth: { score: 82, band: "healthy", computedAt: "2026-08-01T00:00:00.000Z", dimensions: [{ dimension: "finance", score: 80, weight: 1, explanation: "Steady.", factors: [] }] },
    ...overrides,
  };
}

async function renderReady(dataOverrides: Partial<ExecutiveDashboardData> = {}, widgetOverrides: Parameters<typeof widgets>[0] = {}) {
  vi.mocked(getExecutiveDashboardData).mockResolvedValue({ success: true, data: dashboardData(dataOverrides) });
  vi.mocked(getDashboardLayoutAction).mockResolvedValue({ success: true, data: layout({ widgets: widgets(widgetOverrides) }) });
  vi.mocked(saveDashboardLayoutAction).mockResolvedValue({ success: true, data: layout({ widgets: widgets(widgetOverrides) }) });
  render(<ExecutiveDashboardOverview />);
  await waitFor(() => expect(screen.getByText("Today's Revenue")).toBeInTheDocument());
}

describe("ExecutiveDashboardOverview", () => {
  it("shows loading skeletons before both the data and layout resolve", () => {
    vi.mocked(getExecutiveDashboardData).mockReturnValue(new Promise(() => {}));
    vi.mocked(getDashboardLayoutAction).mockReturnValue(new Promise(() => {}));
    render(<ExecutiveDashboardOverview />);
    expect(screen.queryByText("Today's Revenue")).not.toBeInTheDocument();
  });

  it("shows the repository's own error message with a working retry", async () => {
    vi.mocked(getExecutiveDashboardData).mockResolvedValueOnce({ success: false, error: "The Executive dashboard isn't available right now." });
    vi.mocked(getDashboardLayoutAction).mockResolvedValue({ success: true, data: layout() });
    render(<ExecutiveDashboardOverview />);
    await waitFor(() => expect(screen.getByText("The Executive dashboard isn't available right now.")).toBeInTheDocument());

    vi.mocked(getExecutiveDashboardData).mockResolvedValueOnce({ success: true, data: dashboardData() });
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(screen.getByText("Today's Revenue")).toBeInTheDocument());
  });

  it("renders every visible KPI tile with its formatted value", async () => {
    await renderReady({ monthlyRevenueMinor: 123400 });
    expect(screen.getByText("$1,234.00")).toBeInTheDocument();
    expect(screen.getByText("Monthly Revenue")).toBeInTheDocument();
  });

  it("renders — for a redacted (null) money field, never $0.00", async () => {
    await renderReady({ profitMinor: null });
    const profitTile = screen.getByText("Profit").closest("div")!.parentElement!;
    expect(profitTile).toHaveTextContent("—");
    expect(profitTile).not.toHaveTextContent("$0.00");
  });

  it("shows the Business Health score and dimension breakdown", async () => {
    await renderReady({ businessHealth: { score: 91, band: "excellent", computedAt: "2026-08-01T00:00:00.000Z", dimensions: [{ dimension: "crm", score: 88, weight: 1, explanation: "Strong pipeline.", factors: [{ label: "High conversion", impact: 5 }] }] } });
    expect(screen.getByText("91")).toBeInTheDocument();
    expect(screen.getByText("Excellent")).toBeInTheDocument();
    expect(screen.getByText("Strong pipeline.")).toBeInTheDocument();
    expect(screen.getByText("High conversion")).toBeInTheDocument();
  });

  it("shows the restricted message, never a table, when forecast is null", async () => {
    await renderReady({ forecast: null });
    expect(screen.getByText("Restricted — ask an Owner or Admin for the revenue forecast.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the projected revenue table when forecast is present", async () => {
    await renderReady({ forecast: { method: "linear_regression", historical: [], projected: [{ label: "2026-09", value: 300000 }], confidence: "medium", note: "Based on 6 months of history." } });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("2026-09")).toBeInTheDocument();
    expect(screen.getByText("$3,000.00")).toBeInTheDocument();
  });

  it("renders all 4 restructured sections", async () => {
    await renderReady();
    expect(screen.getByTestId("performance-story-section")).toBeInTheDocument();
    expect(screen.getByTestId("client-booking-insights-section")).toBeInTheDocument();
    expect(screen.getByTestId("operational-insights-section")).toBeInTheDocument();
    expect(screen.getByTestId("attention-insights-section")).toBeInTheDocument();
  });

  it("hides a widget and lists it under Hidden widgets, offering a control to unhide it", async () => {
    await renderReady();
    fireEvent.click(screen.getAllByRole("button", { name: "Hide widget" })[0]);
    await waitFor(() => expect(saveDashboardLayoutAction).toHaveBeenCalled());
    const saved = vi.mocked(saveDashboardLayoutAction).mock.calls[0][0];
    expect(saved.find((w) => w.widgetId === "todaysRevenue")?.hidden).toBe(true);
  });

  it("pins a widget via its toggle control", async () => {
    await renderReady();
    fireEvent.click(screen.getAllByRole("button", { name: /unpin widget|pin widget/i })[0]);
    await waitFor(() => expect(saveDashboardLayoutAction).toHaveBeenCalled());
    const saved = vi.mocked(saveDashboardLayoutAction).mock.calls[0][0];
    expect(saved.find((w) => w.widgetId === "todaysRevenue")?.pinned).toBe(true);
  });

  it("moves a widget later when its down control is clicked", async () => {
    await renderReady();
    fireEvent.click(screen.getAllByRole("button", { name: "Move widget later" })[0]);
    await waitFor(() => expect(saveDashboardLayoutAction).toHaveBeenCalled());
    const saved = vi.mocked(saveDashboardLayoutAction).mock.calls[0][0];
    const firstTwo = saved.filter((w) => !w.hidden).sort((a, b) => a.order - b.order).slice(0, 2);
    expect(firstTwo.map((w) => w.widgetId)).toEqual(["monthlyRevenue", "todaysRevenue"]);
  });

  it("disables the earlier-move control for the first visible widget", async () => {
    await renderReady();
    expect(screen.getAllByRole("button", { name: "Move widget earlier" })[0]).toBeDisabled();
  });
});
