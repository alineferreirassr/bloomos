import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ViewToggle } from "@/modules/services/components/ViewToggle";

describe("ViewToggle", () => {
  it("marks the current mode as pressed via aria-pressed", () => {
    render(<ViewToggle value="grid" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the other mode when clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ViewToggle value="grid" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "List view" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });

  it("is grouped for assistive technology", () => {
    render(<ViewToggle value="list" onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "View mode" })).toBeInTheDocument();
  });
});
