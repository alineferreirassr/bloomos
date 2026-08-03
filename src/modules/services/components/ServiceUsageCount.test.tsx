import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceUsageCount } from "@/modules/services/components/ServiceUsageCount";

describe("ServiceUsageCount", () => {
  it("displays 'Not assigned' for zero", () => {
    render(<ServiceUsageCount count={0} />);
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
  });

  it("uses singular phrasing for exactly one", () => {
    render(<ServiceUsageCount count={1} />);
    expect(screen.getByText("1 Event")).toBeInTheDocument();
  });

  it("uses plural phrasing for more than one", () => {
    render(<ServiceUsageCount count={4} />);
    expect(screen.getByText("4 Events")).toBeInTheDocument();
  });

  it("always exposes the exact numeric value to screen readers, even for the zero case", () => {
    render(<ServiceUsageCount count={0} />);
    expect(screen.getByLabelText("0 events")).toBeInTheDocument();
  });
});
