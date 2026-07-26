import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventArchivedBanner } from "@/modules/events/components/EventArchivedBanner";

describe("EventArchivedBanner", () => {
  it("shows the archived explanation", () => {
    render(<EventArchivedBanner />);
    expect(screen.getByText(/This Event is archived/)).toBeInTheDocument();
  });

  it("renders no Restore button when onRestore is omitted", () => {
    render(<EventArchivedBanner />);
    expect(screen.queryByRole("button", { name: /restore/i })).not.toBeInTheDocument();
  });

  it("calls onRestore directly with no confirmation step", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(<EventArchivedBanner onRestore={onRestore} />);
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("disables Restore while pending, showing a busy label", () => {
    render(<EventArchivedBanner onRestore={vi.fn()} restorePending />);
    expect(screen.getByRole("button", { name: "Restoring…" })).toBeDisabled();
  });

  it("disables Restore when permission is denied, with a title explaining why", () => {
    render(<EventArchivedBanner onRestore={vi.fn()} restoreDisabled restoreDisabledReason="You don't have access to manage Events." />);
    const button = screen.getByRole("button", { name: "Restore" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "You don't have access to manage Events.");
  });
});
