import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/analytics/operationsAnalytics/getOperationsAnalyticsData", () => ({
  getOperationsAnalyticsData: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { OperationalInsightsSection } from "@/modules/analytics/components/OperationalInsightsSection";
import { getOperationsAnalyticsData } from "@/modules/analytics/operationsAnalytics/getOperationsAnalyticsData";
import type { OperationsAnalyticsData } from "@/modules/analytics/operationsAnalytics/getOperationsAnalyticsData";

function data(overrides: Partial<OperationsAnalyticsData> = {}): OperationsAnalyticsData {
  return {
    teamUtilizationPercent: 50,
    vendorUtilizationPercent: 25,
    vendorPerformance: [],
    inventoryUsage: [],
    purchaseCount: 0,
    totalPurchaseCostMinor: null,
    lateTaskCount: 2,
    totalChecklistItemCount: 10,
    averageEventHealthScore: 87,
    operationalEfficiencyPercent: 87,
    ...overrides,
  };
}

describe("OperationalInsightsSection", () => {
  it("shows a loading skeleton before data resolves", () => {
    vi.mocked(getOperationsAnalyticsData).mockReturnValue(new Promise(() => {}));
    render(<OperationalInsightsSection />);
    expect(screen.queryByText("Operational Insights")).not.toBeInTheDocument();
  });

  it("shows the repository's own error message on failure", async () => {
    vi.mocked(getOperationsAnalyticsData).mockResolvedValue({ success: false, error: "Operations analytics isn't available right now." });
    render(<OperationalInsightsSection />);
    await waitFor(() => expect(screen.getByText("Operations analytics isn't available right now.")).toBeInTheDocument());
  });

  it("renders late tasks, utilization, and average event health", async () => {
    vi.mocked(getOperationsAnalyticsData).mockResolvedValue({ success: true, data: data({ lateTaskCount: 5, teamUtilizationPercent: 66, vendorUtilizationPercent: 33, averageEventHealthScore: 91 }) });
    render(<OperationalInsightsSection />);
    await waitFor(() => expect(screen.getByText("5")).toBeInTheDocument());
    expect(screen.getByText("66%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByText("91")).toBeInTheDocument();
  });

  it("renders — for null utilization/health figures rather than 0 or blank", async () => {
    vi.mocked(getOperationsAnalyticsData).mockResolvedValue({
      success: true,
      data: data({ teamUtilizationPercent: null, vendorUtilizationPercent: null, averageEventHealthScore: null }),
    });
    render(<OperationalInsightsSection />);
    await waitFor(() => expect(screen.getByText("Operational Insights")).toBeInTheDocument());
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("never renders totalPurchaseCostMinor — that field isn't finance-gated yet", async () => {
    vi.mocked(getOperationsAnalyticsData).mockResolvedValue({ success: true, data: data({ totalPurchaseCostMinor: 500000 }) });
    render(<OperationalInsightsSection />);
    await waitFor(() => expect(screen.getByText("Operational Insights")).toBeInTheDocument());
    expect(screen.queryByText(/5,000\.00|\$5,000/)).not.toBeInTheDocument();
  });

  it("links to the full Operations tab", async () => {
    vi.mocked(getOperationsAnalyticsData).mockResolvedValue({ success: true, data: data() });
    render(<OperationalInsightsSection />);
    const link = await screen.findByRole("link", { name: /open operations/i });
    expect(link).toHaveAttribute("href", "/operations");
  });
});
