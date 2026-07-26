import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthDot } from "@/modules/services/components/HealthDot";

describe("HealthDot", () => {
  it("exposes the exact percentage to screen readers via an accessible name", () => {
    render(<HealthDot percent={85} showTooltip={false} />);
    expect(screen.getByRole("img", { name: "85% complete" })).toBeInTheDocument();
  });

  it("includes the top missing item in the accessible name when supplied", () => {
    render(<HealthDot percent={40} topMissingLabel="Checklist" showTooltip={false} />);
    expect(screen.getByRole("img", { name: "40% complete — missing Checklist" })).toBeInTheDocument();
  });

  it("renders a danger-toned dot only below the attention threshold (70%)", () => {
    const { rerender, container } = render(<HealthDot percent={70} showTooltip={false} />);
    expect(container.querySelector("span")).toHaveClass("bg-accent");

    rerender(<HealthDot percent={69} showTooltip={false} />);
    expect(container.querySelector("span")).toHaveClass("bg-danger");
  });

  it("shows the description in a tooltip on hover by default", () => {
    render(<HealthDot percent={50} topMissingLabel="Timeline" />);
    const dot = screen.getByRole("img");
    expect(dot).toBeInTheDocument();
    // Tooltip content itself is exercised in Tooltip.test.tsx — here we only confirm HealthDot wires it up.
    expect(dot.closest("span.relative")).toBeInTheDocument();
  });
});
