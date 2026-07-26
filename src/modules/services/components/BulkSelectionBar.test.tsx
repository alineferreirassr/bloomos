import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BulkSelectionBar } from "@/modules/services/components/BulkSelectionBar";

describe("BulkSelectionBar", () => {
  it("shows the exact selected/total counts", () => {
    render(<BulkSelectionBar selectedCount={3} totalCount={12} onSelectAll={vi.fn()} onClear={vi.fn()} onExit={vi.fn()} />);
    expect(screen.getByText("3 of 12 selected")).toBeInTheDocument();
  });

  it("calls onSelectAll / onClear / onExit", async () => {
    const user = userEvent.setup();
    const onSelectAll = vi.fn();
    const onClear = vi.fn();
    const onExit = vi.fn();
    render(<BulkSelectionBar selectedCount={1} totalCount={5} onSelectAll={onSelectAll} onClear={onClear} onExit={onExit} />);

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(onSelectAll).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("renders bulk mutation placeholders as disabled-with-explanation, not wired to any action yet", async () => {
    render(<BulkSelectionBar selectedCount={2} totalCount={5} onSelectAll={vi.fn()} onClear={vi.fn()} onExit={vi.fn()} />);

    const activate = screen.getByRole("button", { name: "Activate" });
    expect(activate).toHaveAttribute("aria-disabled", "true");
    // Not natively disabled — stays focusable/hoverable so its Tooltip explanation is reachable.
    expect(activate).not.toBeDisabled();

    activate.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Bulk actions are coming in a future update.");
  });

  it("is exposed as a toolbar for assistive technology", () => {
    render(<BulkSelectionBar selectedCount={0} totalCount={5} onSelectAll={vi.fn()} onClear={vi.fn()} onExit={vi.fn()} />);
    expect(screen.getByRole("toolbar", { name: "Bulk actions" })).toBeInTheDocument();
  });
});
