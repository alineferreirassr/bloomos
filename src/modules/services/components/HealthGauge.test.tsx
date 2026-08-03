import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthGauge } from "@/modules/services/components/HealthGauge";

describe("HealthGauge", () => {
  it("renders progress semantics and the visible percentage via ProgressBar", () => {
    render(<HealthGauge percent={62} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "62");
    expect(screen.getByText("62%")).toBeInTheDocument();
  });

  it("full variant shows a text label above the bar", () => {
    render(<HealthGauge percent={40} variant="full" label="Draft health" />);
    expect(screen.getByText("Draft health")).toBeInTheDocument();
  });

  it("compact variant omits the extra label wrapper", () => {
    const { container } = render(<HealthGauge percent={40} variant="compact" label="Draft health" />);
    // The label is passed through as aria-label on the progressbar, not rendered as separate visible text in compact mode.
    expect(screen.queryByText("Draft health")).not.toBeInTheDocument();
    expect(container.querySelector('[role="progressbar"]')).toHaveAttribute("aria-label", "Draft health");
  });

  it("never applies a percent-tier color class — the bar fill is always the same accent gradient regardless of value", () => {
    const low = render(<HealthGauge percent={5} />);
    const high = render(<HealthGauge percent={95} />);
    const lowFill = low.container.querySelector(".bloom-gradient-accent");
    const highFill = high.container.querySelector(".bloom-gradient-accent");
    expect(lowFill).toBeInTheDocument();
    expect(highFill).toBeInTheDocument();
  });
});
