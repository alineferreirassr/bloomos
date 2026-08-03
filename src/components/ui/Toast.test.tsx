import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast } from "@/components/ui/Toast";

describe("Toast", () => {
  it("renders the message inside a polite status region", () => {
    render(<Toast message="Version 3 published." onDismiss={vi.fn()} autoDismissMs={0} />);
    expect(screen.getByRole("status")).toHaveTextContent("Version 3 published.");
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Toast message="Done." onDismiss={onDismiss} autoDismissMs={0} />);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("auto-dismisses after the given duration", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Done." onDismiss={onDismiss} autoDismissMs={3000} />);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("never auto-dismisses when autoDismissMs is 0", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<Toast message="Done." onDismiss={onDismiss} autoDismissMs={0} />);
    vi.advanceTimersByTime(60000);
    expect(onDismiss).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
