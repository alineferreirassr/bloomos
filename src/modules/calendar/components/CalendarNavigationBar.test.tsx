import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CalendarNavigationBar } from "@/modules/calendar/components/CalendarNavigationBar";

describe("CalendarNavigationBar", () => {
  const anchorDate = new Date(2026, 6, 15); // 15 Jul 2026

  it("renders the month label for month view", () => {
    render(
      <CalendarNavigationBar
        anchorDate={anchorDate}
        view="month"
        onViewChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    expect(screen.getByRole("heading", { name: "July 2026" })).toBeInTheDocument();
  });

  it("calls onPrevious/onNext/onToday", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onToday = vi.fn();
    render(
      <CalendarNavigationBar
        anchorDate={anchorDate}
        view="month"
        onViewChange={vi.fn()}
        onPrevious={onPrevious}
        onNext={onNext}
        onToday={onToday}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Today" }));

    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);
  });

  it("switches view via the toggle group", async () => {
    const user = userEvent.setup();
    const onViewChange = vi.fn();
    render(
      <CalendarNavigationBar
        anchorDate={anchorDate}
        view="month"
        onViewChange={onViewChange}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Calendar view" });
    await user.click(within(group).getByText("Week"));
    expect(onViewChange).toHaveBeenCalledWith("week");
  });

  it("marks the active view as pressed", () => {
    render(
      <CalendarNavigationBar
        anchorDate={anchorDate}
        view="day"
        onViewChange={vi.fn()}
        onPrevious={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
      />,
    );
    expect(screen.getByText("Day")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Month")).toHaveAttribute("aria-pressed", "false");
  });
});
