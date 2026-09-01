import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RevenueTrendChart } from "@/modules/analytics/components/RevenueTrendChart";

describe("RevenueTrendChart", () => {
  it("renders one bar per row, labeled by the accessible chart title", () => {
    const { container } = render(
      <RevenueTrendChart
        rows={[
          { label: "2026-01", revenueMinor: 100000 },
          { label: "2026-02", revenueMinor: 200000 },
          { label: "2026-03", revenueMinor: 50000 },
        ]}
        currency="usd"
      />,
    );
    expect(screen.getByRole("img", { name: "Monthly revenue trend" })).toBeInTheDocument();
    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });

  it("converts YYYY-MM row labels into short month abbreviations", () => {
    render(<RevenueTrendChart rows={[{ label: "2026-08", revenueMinor: 100000 }]} currency="usd" />);
    expect(screen.getByText("Aug")).toBeInTheDocument();
  });

  it("renders a formatted-money tooltip per bar", () => {
    const { container } = render(<RevenueTrendChart rows={[{ label: "2026-01", revenueMinor: 150000 }]} currency="usd" />);
    const title = container.querySelector("title");
    expect(title?.textContent).toBe("2026-01: $1,500.00");
  });

  it("renders no bars for an empty row set without throwing", () => {
    const { container } = render(<RevenueTrendChart rows={[]} currency="usd" />);
    expect(container.querySelectorAll("rect")).toHaveLength(0);
    expect(screen.getByRole("img", { name: "Monthly revenue trend" })).toBeInTheDocument();
  });
});
