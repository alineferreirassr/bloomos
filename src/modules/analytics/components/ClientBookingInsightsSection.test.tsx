import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/modules/analytics/benchmark/getBenchmarkData", () => ({
  getBenchmarkData: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

import { ClientBookingInsightsSection } from "@/modules/analytics/components/ClientBookingInsightsSection";
import { getBenchmarkData } from "@/modules/analytics/benchmark/getBenchmarkData";
import type { BenchmarkData } from "@/modules/analytics/benchmark/getBenchmarkData";
import type { BenchmarkResult } from "@/types/businessIntelligence";

function result(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    label: "label",
    values: [{ period: "thisMonth", value: 0 }],
    changeVsLastMonthPercent: null,
    changeVsSameMonthLastYearPercent: null,
    ...overrides,
  };
}

function data(overrides: Partial<BenchmarkData> = {}): BenchmarkData {
  return {
    revenue: null,
    profit: null,
    eventsBooked: result(),
    newClients: result(),
    ...overrides,
  };
}

describe("ClientBookingInsightsSection", () => {
  it("shows a loading skeleton before data resolves", () => {
    vi.mocked(getBenchmarkData).mockReturnValue(new Promise(() => {}));
    render(<ClientBookingInsightsSection />);
    expect(screen.queryByText("Client & Booking Insights")).not.toBeInTheDocument();
  });

  it("shows the repository's own error message on failure", async () => {
    vi.mocked(getBenchmarkData).mockResolvedValue({ success: false, error: "Benchmark data isn't available right now." });
    render(<ClientBookingInsightsSection />);
    await waitFor(() => expect(screen.getByText("Benchmark data isn't available right now.")).toBeInTheDocument());
  });

  it("renders this month's events booked and new clients from the benchmark data", async () => {
    vi.mocked(getBenchmarkData).mockResolvedValue({
      success: true,
      data: data({
        eventsBooked: result({ values: [{ period: "thisMonth", value: 12 }], changeVsLastMonthPercent: 20 }),
        newClients: result({ values: [{ period: "thisMonth", value: 4 }], changeVsLastMonthPercent: -10 }),
      }),
    });
    render(<ClientBookingInsightsSection />);
    await waitFor(() => expect(screen.getByText("12")).toBeInTheDocument());
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("+20% vs. last month")).toBeInTheDocument();
    expect(screen.getByText("-10% vs. last month")).toBeInTheDocument();
  });

  it("shows 0 and no change text when thisMonth is missing or change is null", async () => {
    vi.mocked(getBenchmarkData).mockResolvedValue({
      success: true,
      data: data({
        eventsBooked: result({ values: [], changeVsLastMonthPercent: null }),
        newClients: result({ values: [{ period: "lastMonth", value: 5 }], changeVsLastMonthPercent: null }),
      }),
    });
    render(<ClientBookingInsightsSection />);
    await waitFor(() => expect(screen.getByText("Events booked this month")).toBeInTheDocument());
    expect(screen.getAllByText("0")).toHaveLength(2);
  });
});
