import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProgressBar } from "@/components/ui/ProgressBar";

describe("ProgressBar", () => {
  it("exposes role=progressbar with aria-valuenow/min/max", () => {
    render(<ProgressBar value={42} label="Service health" />);
    const bar = screen.getByRole("progressbar", { name: "Service health" });
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
  });

  it("always renders the percentage as visible text, never color alone", () => {
    render(<ProgressBar value={73} />);
    expect(screen.getByText("73%")).toBeInTheDocument();
  });

  it("clamps values above 100 and below 0", () => {
    const { rerender } = render(<ProgressBar value={150} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("100%")).toBeInTheDocument();

    rerender(<ProgressBar value={-20} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("rounds fractional values for both the aria attribute and the visible text", () => {
    render(<ProgressBar value={33.6} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "34");
    expect(screen.getByText("34%")).toBeInTheDocument();
  });
});
