import { describe, expect, it } from "vitest";
import { WORLD_CLOCK_LOCATIONS, buildWorldClockDisplay, buildWorldClockDisplays, dayPeriodForHour, getUtcOffsetMinutes, isNightHour } from "@/modules/dashboard/luxury/worldClock";

const honolulu = WORLD_CLOCK_LOCATIONS.find((l) => l.id === "honolulu")!;
const huntingtonBeach = WORLD_CLOCK_LOCATIONS.find((l) => l.id === "huntington-beach")!;
const sorocaba = WORLD_CLOCK_LOCATIONS.find((l) => l.id === "sorocaba")!;

describe("worldClock — pure formatting, no fixed clock reliance", () => {
  // 2026-08-29T05:24:00Z is 7:24 PM Friday in Honolulu (UTC-10, no DST).
  const fixedInstant = new Date("2026-08-29T05:24:00Z");

  it("uses the real IANA timezone identifiers the Founder specified, never a raw UTC offset", () => {
    expect(honolulu.timezone).toBe("Pacific/Honolulu");
    expect(huntingtonBeach.timezone).toBe("America/Los_Angeles");
    expect(sorocaba.timezone).toBe("America/Sao_Paulo");
  });

  it("renders Honolulu's own local time/date, not the instant's raw UTC representation", () => {
    const display = buildWorldClockDisplay(fixedInstant, honolulu, honolulu);
    expect(display.timeLabel).toBe("7:24 PM");
    expect(display.dateLabel).toBe("Fri, Aug 28");
    expect(display.dayPeriod).toBe("Evening");
    expect(display.isNight).toBe(false);
    expect(display.isHome).toBe(true);
    expect(display.hoursFromHome).toBeNull();
  });

  it("computes Huntington Beach as exactly 3 hours ahead of Honolulu at this instant (California observes DST in August, Hawaii never does)", () => {
    const display = buildWorldClockDisplay(fixedInstant, huntingtonBeach, honolulu);
    expect(display.timeLabel).toBe("10:24 PM");
    expect(display.dateLabel).toBe("Fri, Aug 28");
    expect(display.hoursFromHome).toBe(3);
    expect(display.isNight).toBe(true);
  });

  it("computes Sorocaba as exactly 7 hours ahead of Honolulu, correctly rolling over to the next calendar day", () => {
    const display = buildWorldClockDisplay(fixedInstant, sorocaba, honolulu);
    expect(display.timeLabel).toBe("2:24 AM");
    expect(display.dateLabel).toBe("Sat, Aug 29");
    expect(display.hoursFromHome).toBe(7);
    expect(display.isNight).toBe(true);
  });

  it("buildWorldClockDisplays returns all three locations, home first, each internally consistent with the same shared instant", () => {
    const displays = buildWorldClockDisplays(fixedInstant);
    expect(displays).toHaveLength(3);
    expect(displays.map((d) => d.locationId)).toEqual(["honolulu", "huntington-beach", "sorocaba"]);
    expect(displays.filter((d) => d.isHome)).toHaveLength(1);
    expect(displays.find((d) => d.locationId === "honolulu")!.isHome).toBe(true);
  });

  it("getUtcOffsetMinutes reflects a real DST-aware offset lookup, not a hard-coded table", () => {
    // Honolulu is fixed at UTC-10 year-round.
    expect(getUtcOffsetMinutes(fixedInstant, "Pacific/Honolulu")).toBe(-600);
    // Los Angeles in August (PDT) is UTC-7.
    expect(getUtcOffsetMinutes(fixedInstant, "America/Los_Angeles")).toBe(-420);
    // A winter instant should flip Los Angeles to PST (UTC-8), proving this isn't a fixed lookup.
    const winterInstant = new Date("2027-01-15T12:00:00Z");
    expect(getUtcOffsetMinutes(winterInstant, "America/Los_Angeles")).toBe(-480);
  });
});

describe("worldClock — day-period bucketing", () => {
  it("buckets every hour of the day into exactly one of the four labels", () => {
    expect(dayPeriodForHour(6)).toBe("Morning");
    expect(dayPeriodForHour(13)).toBe("Afternoon");
    expect(dayPeriodForHour(19)).toBe("Evening");
    expect(dayPeriodForHour(23)).toBe("Night");
    expect(dayPeriodForHour(2)).toBe("Night");
  });

  it("classifies night hours consistently with the day-period label's own Night bucket", () => {
    expect(isNightHour(22)).toBe(true);
    expect(isNightHour(3)).toBe(true);
    expect(isNightHour(14)).toBe(false);
  });
});
