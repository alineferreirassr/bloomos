import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateCategoryHeader } from "@/modules/services/components/TemplateCategoryHeader";

describe("TemplateCategoryHeader", () => {
  it("shows the count badge when the category has items", () => {
    render(<TemplateCategoryHeader label="Included Items" expectation="optional" count={3} expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows 'Expected' for an empty expected category and 'Optional' for an empty optional one", () => {
    const { rerender } = render(<TemplateCategoryHeader label="Checklist Items" expectation="expected" count={0} expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Expected")).toBeInTheDocument();

    rerender(<TemplateCategoryHeader label="Included Items" expectation="optional" count={0} expanded={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("calls onToggle when clicked (plain header)", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<TemplateCategoryHeader label="Included Items" expectation="optional" count={0} expanded={false} onToggle={onToggle} />);
    await user.click(screen.getByRole("button", { name: /Included Items/ }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders via RequirementCard for a category with a requirementVariant, with Expand/Collapse as the primary action", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<TemplateCategoryHeader label="Inventory Needs" expectation="optional" count={0} expanded={false} onToggle={onToggle} requirementVariant="inventory" />);
    const expandButton = screen.getByRole("button", { name: "Expand" });
    await user.click(expandButton);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
