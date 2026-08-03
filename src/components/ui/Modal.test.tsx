import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "@/components/ui/Modal";

describe("Modal", () => {
  it("renders nothing when closed, and the dialog when open", () => {
    const { rerender } = render(
      <Modal open={false} onClose={vi.fn()} title="Confirm">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(
      <Modal open={true} onClose={vi.fn()} title="Confirm">
        <p>Are you sure?</p>
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Confirm">
        <button type="button">Focusable</button>
      </Modal>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} onClose={onClose} title="Confirm">
        <p>content</p>
      </Modal>,
    );

    // Both the backdrop and the header close button share the "Close dialog" label — the backdrop is the first in source order.
    await user.click(screen.getAllByLabelText("Close dialog")[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it("moves focus into the dialog on open, and wraps Tab from the last focusable element back to the first", async () => {
    const user = userEvent.setup();
    render(
      <Modal open={true} onClose={vi.fn()} title="Confirm">
        <button type="button">Content action</button>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog");
    const closeButton = within(dialog).getByRole("button", { name: "Close dialog" });
    const contentAction = within(dialog).getByRole("button", { name: "Content action" });
    // The header's close button is the first focusable descendant in DOM order.
    expect(closeButton).toHaveFocus();

    contentAction.focus();
    await user.tab();
    // Tabbing past the last focusable element wraps back to the first (the close button) rather than escaping the dialog.
    expect(closeButton).toHaveFocus();
  });

  it("returns focus to the triggering element on close", () => {
    render(
      <div>
        <button type="button">Open trigger</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Open trigger" });
    trigger.focus();
    expect(trigger).toHaveFocus();

    const { rerender } = render(
      <Modal open={true} onClose={vi.fn()} title="Confirm">
        <p>content</p>
      </Modal>,
    );
    rerender(
      <Modal open={false} onClose={vi.fn()} title="Confirm">
        <p>content</p>
      </Modal>,
    );
    expect(trigger).toHaveFocus();
  });

  it("locks page scroll while open and restores it on close", () => {
    const { rerender } = render(
      <Modal open={true} onClose={vi.fn()} title="Confirm">
        <p>content</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <Modal open={false} onClose={vi.fn()} title="Confirm">
        <p>content</p>
      </Modal>,
    );
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});
