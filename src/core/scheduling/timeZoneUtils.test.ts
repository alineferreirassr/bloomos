import { describe, expect, it } from "vitest";
import { resolveLocalDateTime } from "@/core/scheduling/timeZoneUtils";

describe("resolveLocalDateTime", () => {
  it("resolves a UTC instant to the correct local date/time in a negative-offset zone", () => {
    // 2026-08-03T02:00:00Z is 2026-08-02T23:00 in America/Sao_Paulo (UTC-3).
    const result = resolveLocalDateTime("2026-08-03T02:00:00.000Z", "America/Sao_Paulo");
    expect(result).toEqual({ localDate: "2026-08-02", dayOfWeek: 0, localTime: "23:00" });
  });

  it("resolves a UTC instant to the correct local date/time in a positive-offset zone", () => {
    // 2026-08-03T22:00:00Z is 2026-08-04T07:00 in Asia/Tokyo (UTC+9).
    const result = resolveLocalDateTime("2026-08-03T22:00:00.000Z", "Asia/Tokyo");
    expect(result).toEqual({ localDate: "2026-08-04", dayOfWeek: 2, localTime: "07:00" });
  });

  it("resolves midnight local time as 00:00, not 24:00", () => {
    const result = resolveLocalDateTime("2026-08-03T00:00:00.000Z", "UTC");
    expect(result.localTime).toBe("00:00");
  });

  it("computes the correct weekday for the resolved local date", () => {
    // 2026-08-03T12:00:00Z in UTC is a Monday.
    const result = resolveLocalDateTime("2026-08-03T12:00:00.000Z", "UTC");
    expect(result.dayOfWeek).toBe(1);
  });
});
