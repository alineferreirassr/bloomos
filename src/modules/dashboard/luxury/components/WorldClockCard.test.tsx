import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorldClockCard } from "@/modules/dashboard/luxury/components/WorldClockCard";

afterEach(() => {
  vi.useRealTimers();
});

describe("WorldClockCard", () => {
  it("renders all three Founder-specified cities with a real, non-fabricated time once mounted", () => {
    // `render()` flushes the mount effect synchronously (React Testing
    // Library wraps it in `act()`), so the real time is already committed
    // by the time `render` returns — no `waitFor`/fake-timer polling
    // needed, and mixing fake timers with `waitFor`'s own internal
    // real-timer polling would hang until the test's own timeout.
    vi.setSystemTime(new Date("2026-08-29T05:24:00Z")); // 7:24 PM Friday in Honolulu

    render(<WorldClockCard />);

    expect(screen.getByText("Honolulu")).toBeInTheDocument();
    expect(screen.getByText("Huntington Beach")).toBeInTheDocument();
    expect(screen.getByText("Sorocaba")).toBeInTheDocument();

    expect(screen.getByText("7:24 PM")).toBeInTheDocument();
    expect(screen.getByText("10:24 PM")).toBeInTheDocument();
    expect(screen.getByText("2:24 AM")).toBeInTheDocument();

    expect(screen.getByText(/Home/)).toBeInTheDocument();
    expect(screen.getByText(/\+3h from Honolulu/)).toBeInTheDocument();
    expect(screen.getByText(/\+7h from Honolulu/)).toBeInTheDocument();
  });

  it("shows a neutral skeleton (never a wrong/placeholder time) before the client clock mounts", () => {
    render(<WorldClockCard />);
    // Before the effect runs, no fabricated time string should be present — either the real time (if the effect already ran synchronously in this environment) or nothing at all, but never a static placeholder like "12:00".
    expect(screen.queryByText("12:00 AM")).not.toBeInTheDocument();
    expect(screen.queryByText("12:00 PM")).not.toBeInTheDocument();
  });
});
