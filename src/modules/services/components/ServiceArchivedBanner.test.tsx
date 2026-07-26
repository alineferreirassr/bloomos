import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServiceArchivedBanner } from "@/modules/services/components/ServiceArchivedBanner";

describe("ServiceArchivedBanner", () => {
  it("shows the archived explanation", () => {
    render(<ServiceArchivedBanner />);
    expect(screen.getByText(/This Service is archived/)).toBeInTheDocument();
  });

  it("calls onRestore directly with no confirmation step", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    render(<ServiceArchivedBanner onRestore={onRestore} />);
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("disables Restore while pending, showing a busy label", () => {
    render(<ServiceArchivedBanner onRestore={vi.fn()} restorePending />);
    expect(screen.getByRole("button", { name: "Restoring…" })).toBeDisabled();
  });

  it("disables Restore when permission is denied, with a title explaining why", () => {
    render(<ServiceArchivedBanner onRestore={vi.fn()} restoreDisabled restoreDisabledReason="You don't have access to manage Services." />);
    const button = screen.getByRole("button", { name: "Restore" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "You don't have access to manage Services.");
  });
});
