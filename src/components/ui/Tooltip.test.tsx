import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Tooltip } from "@/components/ui/Tooltip";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Tooltip", () => {
  it("shows the tooltip after a delay on hover, and links it via aria-describedby", () => {
    render(
      <Tooltip content="Extra context">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Extra context");
    expect(trigger).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  });

  it("shows on keyboard focus, not just hover", () => {
    render(
      <Tooltip content="Extra context">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Trigger" }));
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("hides immediately on mouse leave / blur, without waiting for a delay", () => {
    render(
      <Tooltip content="Extra context">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.mouseEnter(trigger);
    act(() => vi.advanceTimersByTime(400));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("never fires if the pointer passes through before the delay elapses", () => {
    render(
      <Tooltip content="Extra context">
        <button type="button">Trigger</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Trigger" });
    fireEvent.mouseEnter(trigger);
    act(() => vi.advanceTimersByTime(200));
    fireEvent.mouseLeave(trigger);
    act(() => vi.advanceTimersByTime(400));

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("preserves the trigger's own existing event handlers instead of replacing them", () => {
    const onFocus = vi.fn();
    render(
      <Tooltip content="Extra context">
        <button type="button" onFocus={onFocus}>
          Trigger
        </button>
      </Tooltip>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Trigger" }));
    expect(onFocus).toHaveBeenCalledTimes(1);
  });
});
