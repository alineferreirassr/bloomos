import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FulfillmentSummaryStrip } from "@/modules/services/components/FulfillmentSummaryStrip";

describe("FulfillmentSummaryStrip", () => {
  it("shows 0% (never NaN or a crash) when total is zero", () => {
    render(<FulfillmentSummaryStrip resolved={0} total={0} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0 of 0 resolved")).toBeInTheDocument();
  });

  it("shows a partial percentage and the exact textual count", () => {
    render(<FulfillmentSummaryStrip resolved={3} total={5} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByText("3 of 5 resolved")).toBeInTheDocument();
  });

  it("shows 100% when everything is resolved", () => {
    render(<FulfillmentSummaryStrip resolved={4} total={4} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("4 of 4 resolved")).toBeInTheDocument();
  });
});
