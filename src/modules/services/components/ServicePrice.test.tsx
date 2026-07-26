import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServicePrice } from "@/modules/services/components/ServicePrice";

describe("ServicePrice", () => {
  it("formats a minor-unit USD amount correctly", () => {
    render(<ServicePrice amountMinor={125000} currency="USD" />);
    expect(screen.getByText("$1,250.00")).toBeInTheDocument();
  });

  it("preserves the supplied currency for a non-USD amount", () => {
    render(<ServicePrice amountMinor={5000} currency="EUR" />);
    expect(screen.getByText("€50.00")).toBeInTheDocument();
  });

  it("renders a real $0.00 price normally — distinct from an unavailable price", () => {
    render(<ServicePrice amountMinor={0} currency="USD" />);
    expect(screen.getByText("$0.00")).toBeInTheDocument();
  });

  it("renders an explicit unavailable state for null, never '$0.00' or a crash", () => {
    render(<ServicePrice amountMinor={null} currency="USD" />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByLabelText("Price unavailable")).toBeInTheDocument();
  });

  it("supports a compact display variant", () => {
    render(<ServicePrice amountMinor={150000000} currency="USD" variant="compact" />);
    expect(screen.getByText(/\$1\.5[MK]/)).toBeInTheDocument();
  });

  it("never produces a floating-point precision regression for amounts that don't divide evenly by 100", () => {
    // 100333 minor units => $1,003.33 exactly, not $1,003.3299999999999 or similar.
    render(<ServicePrice amountMinor={100333} currency="USD" />);
    expect(screen.getByText("$1,003.33")).toBeInTheDocument();
  });

  it("throws rather than silently mis-rendering a non-integer minor-unit amount", () => {
    expect(() => render(<ServicePrice amountMinor={99.5} currency="USD" />)).toThrow();
  });
});
