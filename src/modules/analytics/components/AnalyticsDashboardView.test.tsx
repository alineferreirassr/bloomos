import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/analytics/getAnalyticsDashboardData", () => ({
  getAnalyticsDashboardData: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/core/commandPalette", () => ({
  registerCommand: vi.fn(),
  unregisterCommand: vi.fn(),
}));
vi.mock("@/modules/analytics/components/AnalyticsExecutiveSummaryCard", () => ({
  AnalyticsExecutiveSummaryCard: () => null,
}));
vi.mock("@/modules/analytics/executive/components/ExecutiveDashboardOverview", () => ({
  ExecutiveDashboardOverview: () => null,
}));
vi.mock("@/modules/analytics/revenue/components/RevenueAnalyticsPanel", () => ({
  RevenueAnalyticsPanel: () => null,
}));
vi.mock("@/modules/analytics/profitability/components/ProfitabilityPanel", () => ({
  ProfitabilityPanel: () => null,
}));
vi.mock("@/modules/analytics/funnel/components/SalesFunnelPanel", () => ({
  SalesFunnelPanel: () => null,
}));
vi.mock("@/modules/analytics/clientIntelligence/components/ClientIntelligencePanel", () => ({
  ClientIntelligencePanel: () => null,
}));
vi.mock("@/modules/analytics/eventIntelligence/components/EventIntelligencePanel", () => ({
  EventIntelligencePanel: () => null,
}));
vi.mock("@/modules/analytics/operationsAnalytics/components/OperationsAnalyticsPanel", () => ({
  OperationsAnalyticsPanel: () => null,
}));
vi.mock("@/modules/analytics/forecast/components/FinancialForecastPanel", () => ({
  FinancialForecastPanel: () => null,
}));
vi.mock("@/modules/analytics/goals/components/GoalsPanel", () => ({
  GoalsPanel: () => null,
}));
vi.mock("@/modules/analytics/benchmark/components/BenchmarkPanel", () => ({
  BenchmarkPanel: () => null,
}));
vi.mock("@/modules/analytics/insights/components/ExecutiveInsightsPanel", () => ({
  ExecutiveInsightsPanel: () => null,
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { AnalyticsDashboardView } from "@/modules/analytics/components/AnalyticsDashboardView";
import { getAnalyticsDashboardData } from "@/modules/analytics/getAnalyticsDashboardData";
import { registerCommand, unregisterCommand } from "@/core/commandPalette";

const CATEGORIES = ["revenue", "clients", "events", "documents", "workflow", "ai", "portal"] as const;

function emptyData(overrides: Partial<Record<(typeof CATEGORIES)[number], unknown[]>> = {}) {
  const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, overrides[c] ?? []]));
  return { windowKey: "30d" as const, byCategory, overview: [] };
}

function snapshot(id: string, category: string) {
  return { metric: { id, name: id, description: "desc", category, unit: "count", icon: "DollarSign" }, result: { value: 1, previousValue: null, changePercent: null, trend: "flat" as const, series: [] } };
}

describe("AnalyticsDashboardView", () => {
  it("renders every Step 3 tab: Overview plus one per Metrics Registry category", async () => {
    vi.mocked(getAnalyticsDashboardData).mockResolvedValue({ success: true, data: emptyData() } as never);
    render(<AnalyticsDashboardView />);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument());
    for (const label of ["Revenue", "Clients", "Events", "Documents", "Workflow", "AI", "Portal"]) {
      expect(screen.getByRole("tab", { name: label })).toBeInTheDocument();
    }
  });

  it("shows an empty state on a category tab with no visible metrics, never a blank panel", async () => {
    vi.mocked(getAnalyticsDashboardData).mockResolvedValue({ success: true, data: emptyData() } as never);
    render(<AnalyticsDashboardView />);
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(await screen.findByRole("tab", { name: "Overview" }));
    await waitFor(() => expect(screen.getByText("Nothing to show yet")).toBeInTheDocument());
  });

  it("renders real KPI cards from the aggregate's own overview", async () => {
    vi.mocked(getAnalyticsDashboardData).mockResolvedValue({ success: true, data: { ...emptyData(), overview: [snapshot("revenue.total", "revenue")] } } as never);
    render(<AnalyticsDashboardView />);
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.click(await screen.findByRole("tab", { name: "Overview" }));
    await waitFor(() => expect(screen.getByText("revenue.total")).toBeInTheDocument());
  });

  it("shows an error state with retry when the aggregate fails", async () => {
    vi.mocked(getAnalyticsDashboardData).mockResolvedValue({ success: false, error: "The Analytics dashboard isn't available right now." });
    render(<AnalyticsDashboardView />);
    await waitFor(() => expect(screen.getByText("The Analytics dashboard isn't available right now.")).toBeInTheDocument());
  });

  it("re-fetches when the Trend window changes", async () => {
    vi.mocked(getAnalyticsDashboardData).mockResolvedValue({ success: true, data: emptyData() } as never);
    render(<AnalyticsDashboardView />);
    await waitFor(() => expect(getAnalyticsDashboardData).toHaveBeenCalledWith("30d"));

    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(screen.getByLabelText("Trend window"), { target: { value: "year" } });
    await waitFor(() => expect(getAnalyticsDashboardData).toHaveBeenCalledWith("year"));
  });

  it("registers and unregisters an Analytics Command Palette entry", async () => {
    vi.mocked(getAnalyticsDashboardData).mockResolvedValue({ success: true, data: emptyData() } as never);
    const { unmount } = render(<AnalyticsDashboardView />);
    await waitFor(() => expect(registerCommand).toHaveBeenCalledWith(expect.objectContaining({ id: "open-analytics" })));
    unmount();
    expect(unregisterCommand).toHaveBeenCalledWith("open-analytics");
  });
});
