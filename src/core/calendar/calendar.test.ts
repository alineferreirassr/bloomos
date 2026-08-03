import { describe, expect, it, beforeEach } from "vitest";
import { getRangeForView, goToNext, goToPrevious, goToToday } from "@/core/calendar/navigation";
import {
  registerCalendarEventSource,
  unregisterCalendarEventSource,
  getCalendarEventSources,
  resetCalendarEventSourceRegistry,
} from "@/core/calendar/registry";

describe("getRangeForView", () => {
  it("returns the full month as [1st, 1st of next month) for month view", () => {
    const range = getRangeForView(new Date(2026, 6, 15), "month"); // 15 Jul 2026
    expect(range.start).toEqual(new Date(2026, 6, 1));
    expect(range.end).toEqual(new Date(2026, 7, 1));
  });

  it("rolls a month-view range over a year boundary correctly", () => {
    const range = getRangeForView(new Date(2026, 11, 20), "month"); // 20 Dec 2026
    expect(range.start).toEqual(new Date(2026, 11, 1));
    expect(range.end).toEqual(new Date(2027, 0, 1));
  });

  it("returns a 7-day range starting on Sunday for week view", () => {
    const wednesday = new Date(2026, 6, 15); // Wed 15 Jul 2026
    const range = getRangeForView(wednesday, "week");
    expect(range.start).toEqual(new Date(2026, 6, 12)); // preceding Sunday
    expect(range.end).toEqual(new Date(2026, 6, 19));
  });

  it("returns a single-day [start, start+1) range for day view", () => {
    const range = getRangeForView(new Date(2026, 6, 15, 14, 30), "day");
    expect(range.start).toEqual(new Date(2026, 6, 15));
    expect(range.end).toEqual(new Date(2026, 6, 16));
  });
});

describe("goToNext / goToPrevious", () => {
  it("advances a month anchor to the 1st of the next month, regardless of day-of-month", () => {
    expect(goToNext(new Date(2026, 6, 28), "month")).toEqual(new Date(2026, 7, 1));
  });

  it("rolls month navigation over a year boundary", () => {
    expect(goToNext(new Date(2026, 11, 5), "month")).toEqual(new Date(2027, 0, 1));
    expect(goToPrevious(new Date(2027, 0, 5), "month")).toEqual(new Date(2026, 11, 1));
  });

  it("advances/retreats a week anchor by exactly 7 days", () => {
    const date = new Date(2026, 6, 15);
    expect(goToNext(date, "week")).toEqual(new Date(2026, 6, 22));
    expect(goToPrevious(date, "week")).toEqual(new Date(2026, 6, 8));
  });

  it("advances/retreats a day anchor by exactly 1 day", () => {
    const date = new Date(2026, 6, 15);
    expect(goToNext(date, "day")).toEqual(new Date(2026, 6, 16));
    expect(goToPrevious(date, "day")).toEqual(new Date(2026, 6, 14));
  });
});

describe("goToToday", () => {
  it("returns a Date representing right now", () => {
    const before = Date.now();
    const result = goToToday().getTime();
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

describe("calendar event source registry", () => {
  beforeEach(() => {
    resetCalendarEventSourceRegistry();
  });

  it("starts empty — no source registered by default", () => {
    expect(getCalendarEventSources()).toEqual([]);
  });

  it("registers and unregisters a source", () => {
    registerCalendarEventSource({ sourceType: "event", label: "Events", fetch: async () => [] });
    expect(getCalendarEventSources()).toHaveLength(1);

    unregisterCalendarEventSource("event");
    expect(getCalendarEventSources()).toEqual([]);
  });
});
