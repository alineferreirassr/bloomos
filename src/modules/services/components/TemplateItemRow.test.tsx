import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TemplateItemRow } from "@/modules/services/components/TemplateItemRow";

describe("TemplateItemRow", () => {
  it("renders the label, description, metadata and inline field slots", () => {
    render(
      <TemplateItemRow
        label="Confirm setlist"
        description="Due 5 days before load-in"
        metadata={<span>planning</span>}
        inlineField={<input aria-label="Quantity" />}
      />,
    );
    expect(screen.getByText("Confirm setlist")).toBeInTheDocument();
    expect(screen.getByText("Due 5 days before load-in")).toBeInTheDocument();
    expect(screen.getByText("planning")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
  });

  it("renders the drag handle and inspector trigger slots", () => {
    render(<TemplateItemRow label="Row" dragHandle={<span data-testid="drag">::</span>} inspectorTrigger={<button type="button">Open</button>} />);
    expect(screen.getByTestId("drag")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("renders secondary actions via ActionMenu", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<TemplateItemRow label="Row" actions={[{ label: "Delete", onSelect, destructive: true }]} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("shows a saving indicator", () => {
    render(<TemplateItemRow label="Row" saving />);
    expect(screen.getByText("Saving…")).toBeInTheDocument();
  });

  it("shows a validation error", () => {
    render(<TemplateItemRow label="Row" error="This field is required." />);
    expect(screen.getByRole("alert")).toHaveTextContent("This field is required.");
  });

  it("marks the row aria-disabled when disabled, and dims it visually", () => {
    const { container } = render(<TemplateItemRow label="Row" disabled />);
    expect(container.firstChild).toHaveAttribute("aria-disabled", "true");
    expect(container.firstChild).toHaveClass("opacity-70");
  });

  it("hides the drag handle and shows a lock affordance when locked (published-version lock state)", () => {
    render(<TemplateItemRow label="Row" locked dragHandle={<span data-testid="drag">::</span>} />);
    expect(screen.queryByTestId("drag")).not.toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("treats locked the same as disabled for the row's read-only presentation", () => {
    const { container } = render(<TemplateItemRow label="Row" locked />);
    expect(container.firstChild).toHaveAttribute("aria-disabled", "true");
  });
});
