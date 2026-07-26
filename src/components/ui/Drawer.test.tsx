import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Drawer } from "@/components/ui/Drawer";

describe("Drawer", () => {
  it("renders nothing when closed, and an aria-modal dialog when open", () => {
    const { rerender } = render(
      <Drawer open={false} onClose={vi.fn()} title="Details">
        <p>content</p>
      </Drawer>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <Drawer open={true} onClose={vi.fn()} title="Details">
        <p>content</p>
      </Drawer>,
    );
    const dialog = screen.getByRole("dialog", { name: "Details" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose on Escape and on backdrop click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Drawer open={true} onClose={onClose} title="Details">
        <p>content</p>
      </Drawer>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByLabelText("Close dialog")[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("traps focus within the panel and locks page scroll", async () => {
    const user = userEvent.setup();
    render(
      <Drawer open={true} onClose={vi.fn()} title="Details">
        <button type="button">Only action</button>
      </Drawer>,
    );

    const dialog = screen.getByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: "Close dialog" });
    const action = within(dialog).getByRole("button", { name: "Only action" });

    expect(closeButton).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");

    action.focus();
    await user.tab();
    expect(closeButton).toHaveFocus();
  });
});
