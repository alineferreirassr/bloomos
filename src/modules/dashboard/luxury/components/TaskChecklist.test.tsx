import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskChecklist } from "@/modules/dashboard/luxury/components/TaskChecklist";

const LONG_TITLE = "Order champagne + strawberries (nut-free) for the full guest list, confirmed with the caterer twice";

describe("TaskChecklist", () => {
  it("renders a passive, non-interactive status marker when onToggle is absent — never a checkbox that silently does nothing", () => {
    render(<TaskChecklist items={[{ id: "1", title: "Confirm hotel key access", timeLabel: null, completed: false }]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Pending" })).toBeInTheDocument();
  });

  it("preserves a real interactive checkbox — with aria-pressed and a working onClick — when onToggle is present", async () => {
    const onToggle = vi.fn();
    render(<TaskChecklist items={[{ id: "1", title: "Confirm hotel key access", timeLabel: null, completed: false, onToggle }]} />);

    const button = screen.getByRole("button", { name: 'Mark "Confirm hotel key access" complete' });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("marks a completed passive item as 'Completed', still with no button", () => {
    render(<TaskChecklist items={[{ id: "1", title: "Order florals", timeLabel: null, completed: true }]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Completed" })).toBeInTheDocument();
  });

  it("does not truncate long task titles — the full text is present in the document", () => {
    render(<TaskChecklist items={[{ id: "1", title: LONG_TITLE, timeLabel: null, completed: false }]} />);

    const titleEl = screen.getByText(LONG_TITLE);
    expect(titleEl).toBeInTheDocument();
    expect(titleEl.className).not.toContain("truncate");
  });
});
