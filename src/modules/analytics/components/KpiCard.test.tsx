import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "@/modules/analytics/components/KpiCard";
import type { AnalyticsMetricSnapshot } from "@/types/analytics";

function snapshot(overrides: Partial<AnalyticsMetricSnapshot["result"]> = {}, unit: AnalyticsMetricSnapshot["metric"]["unit"] = "currency"): AnalyticsMetricSnapshot {
  return {
    metric: { id: "revenue.total", name: "Revenue", description: "Total invoice value issued within the selected window.", category: "revenue", unit, icon: "DollarSign" },
    result: { value: 650000, previousValue: 440000, changePercent: 47.7, trend: "up", series: [], ...overrides },
  };
}

describe("KpiCard", () => {
  it("formats a currency metric via formatMoney, never a raw minor-unit number", () => {
    render(<KpiCard snapshot={snapshot()} />);
    expect(screen.getByText("$6,500.00")).toBeInTheDocument();
    expect(screen.getByText("Revenue")).toBeInTheDocument();
  });

  it("formats a percent metric with one decimal and a % sign", () => {
    render(<KpiCard snapshot={snapshot({ value: 62.4 }, "percent")} />);
    expect(screen.getByText("62.4%")).toBeInTheDocument();
  });

  it("formats a count metric as a plain rounded number", () => {
    render(<KpiCard snapshot={snapshot({ value: 12 }, "count")} />);
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("shows an em dash rather than a fabricated percent when changePercent is null", () => {
    render(<KpiCard snapshot={snapshot({ changePercent: null, trend: "flat" })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("gives screen readers a full-sentence trend description, not just an arrow + number", () => {
    render(<KpiCard snapshot={snapshot()} />);
    expect(screen.getByText(/up 47.7 percent versus the prior period/)).toBeInTheDocument();
  });
});
