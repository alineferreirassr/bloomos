import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TemplateCategorySummary } from "@/modules/services/components/TemplateCategorySummary";

describe("TemplateCategorySummary", () => {
  it("shows a plain item count when populated", () => {
    render(<TemplateCategorySummary expectation="optional" count={3} />);
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("uses singular wording for exactly one item", () => {
    render(<TemplateCategorySummary expectation="optional" count={1} />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("shows a missing-required warning for an empty expected category", () => {
    render(<TemplateCategorySummary expectation="expected" count={0} />);
    expect(screen.getByText("Missing — this category is usually expected.")).toBeInTheDocument();
  });

  it("shows a quiet optional message for an empty optional category", () => {
    render(<TemplateCategorySummary expectation="optional" count={0} />);
    expect(screen.getByText("No items yet — optional.")).toBeInTheDocument();
  });
});
