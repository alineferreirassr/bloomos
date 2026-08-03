import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RequirementCard, type RequirementCardVariant } from "@/modules/services/components/RequirementCard";

const VARIANTS: RequirementCardVariant[] = ["inventory", "purchase", "budget", "team", "vendor"];

describe("RequirementCard", () => {
  it.each(VARIANTS)("renders the '%s' variant with title, description and detail", (variant) => {
    render(<RequirementCard variant={variant} title="Confirm setlist" description="Needed before load-in" detail="Qty: 4" />);
    expect(screen.getByText("Confirm setlist")).toBeInTheDocument();
    expect(screen.getByText("Needed before load-in")).toBeInTheDocument();
    expect(screen.getByText("Qty: 4")).toBeInTheDocument();
  });

  it("shows the resolved presentation distinctly from unresolved", () => {
    const { rerender, container } = render(<RequirementCard variant="inventory" title="Chairs" resolved={false} />);
    expect(container.firstChild).not.toHaveClass("opacity-70");

    rerender(<RequirementCard variant="inventory" title="Chairs" resolved />);
    expect(container.firstChild).toHaveClass("opacity-70");
  });

  it("renders a status badge when provided", () => {
    render(<RequirementCard variant="purchase" title="Backdrop" status={{ label: "Fulfilled", tone: "accent" }} />);
    expect(screen.getByText("Fulfilled")).toBeInTheDocument();
  });

  it("renders and fires the primary action", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<RequirementCard variant="vendor" title="Confirm caterer" primaryAction={{ label: "Confirm", onClick }} />);

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows a loading state that disables the action and never calls onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<RequirementCard variant="vendor" title="Confirm caterer" primaryAction={{ label: "Confirm", onClick, loading: true }} />);

    const button = screen.getByRole("button", { name: "Working…" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("explains a disabled action via Tooltip rather than hiding the reason, and never calls onClick", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <RequirementCard
        variant="budget"
        title="Approve estimate"
        primaryAction={{ label: "Approve", onClick, disabled: true, disabledReason: "You don't have permission to approve budget lines." }}
      />,
    );

    const button = screen.getByRole("button", { name: "Approve" });
    // Uses aria-disabled (not native disabled) so it stays focusable/hoverable for the Tooltip.
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toBeDisabled();

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();

    button.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("You don't have permission to approve budget lines.");
  });

  it("renders secondary actions via ActionMenu, positioned consistently in the header", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<RequirementCard variant="team" title="Sound engineer" secondaryActions={[{ label: "Remove", onSelect }]} />);

    await user.click(screen.getByRole("button", { name: "Item actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
