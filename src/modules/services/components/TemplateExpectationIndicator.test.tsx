import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplateExpectationIndicator } from "@/modules/services/components/TemplateExpectationIndicator";

describe("TemplateExpectationIndicator", () => {
  it("shows 'Expected' for an expected-but-empty category", () => {
    render(<TemplateExpectationIndicator expectation="expected" count={0} />);
    expect(screen.getByText("Expected")).toBeInTheDocument();
  });

  it("shows 'Optional' for an optional-and-empty category", () => {
    render(<TemplateExpectationIndicator expectation="optional" count={0} />);
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("shows the count once populated, for both expected and optional categories", () => {
    const { rerender } = render(<TemplateExpectationIndicator expectation="expected" count={3} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByText("Expected")).not.toBeInTheDocument();

    rerender(<TemplateExpectationIndicator expectation="optional" count={2} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("Optional")).not.toBeInTheDocument();
  });
});
