import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/analytics/revenue/getRevenueBreakdown", () => ({
  getRevenueBreakdown: vi.fn(),
}));
vi.mock("@/modules/analytics/components/RevenueTrendChart", () => ({
  RevenueTrendChart: ({ rows }: { rows: { label: string }[] }) => <div data-testid="revenue-trend-chart">{rows.length} rows</div>,
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { PerformanceStorySection } from "@/modules/analytics/components/PerformanceStorySection";
import { getRevenueBreakdown } from "@/modules/analytics/revenue/getRevenueBreakdown";
import type { RevenueBreakdown } from "@/types/businessIntelligence";

function breakdown(overrides: Partial<RevenueBreakdown> = {}): RevenueBreakdown {
  return {
    dimension: "month",
    rows: [],
    totalMinor: 0,
    ...overrides,
  };
}

describe("PerformanceStorySection", () => {
  it("shows a loading skeleton before data resolves", () => {
    vi.mocked(getRevenueBreakdown).mockReturnValue(new Promise(() => {}));
    render(<PerformanceStorySection />);
    expect(screen.queryByText("Performance Story")).not.toBeInTheDocument();
  });

  it("shows a restricted message — never an error/retry — when the caller lacks finance visibility", async () => {
    vi.mocked(getRevenueBreakdown).mockResolvedValue({ success: false, error: "You may not have access to this." });
    render(<PerformanceStorySection />);
    await waitFor(() => expect(screen.getByText("Restricted — ask an Owner or Admin to see the revenue trend.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("shows the empty-state message and no chart when total revenue is 0", async () => {
    vi.mocked(getRevenueBreakdown).mockResolvedValue({ success: true, data: breakdown({ totalMinor: 0, rows: [{ key: "2026-01", label: "2026-01", revenueMinor: 0, drillDown: null }] }) });
    render(<PerformanceStorySection />);
    await waitFor(() => expect(screen.getByText("No revenue collected yet over the trailing year.")).toBeInTheDocument());
    expect(screen.queryByTestId("revenue-trend-chart")).not.toBeInTheDocument();
  });

  it("shows the collected total and renders the chart with mapped rows when revenue exists", async () => {
    vi.mocked(getRevenueBreakdown).mockResolvedValue({
      success: true,
      data: breakdown({
        totalMinor: 250000,
        rows: [
          { key: "2026-01", label: "2026-01", revenueMinor: 100000, drillDown: null },
          { key: "2026-02", label: "2026-02", revenueMinor: 150000, drillDown: null },
        ],
      }),
    });
    render(<PerformanceStorySection />);
    await waitFor(() => expect(screen.getByText("$2,500.00 collected over the trailing year.")).toBeInTheDocument());
    expect(screen.getByTestId("revenue-trend-chart")).toHaveTextContent("2 rows");
  });

  it("requests the month dimension over the trailing year", async () => {
    vi.mocked(getRevenueBreakdown).mockResolvedValue({ success: true, data: breakdown() });
    render(<PerformanceStorySection />);
    await waitFor(() => expect(getRevenueBreakdown).toHaveBeenCalledWith("month", "year"));
  });
});
