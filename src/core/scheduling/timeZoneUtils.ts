/**
 * v2.0 Checkpoint 27 — shared timezone resolution used by every engine
 * that needs to compare a true UTC instant (`Appointment.starts_at`,
 * `CalendarWindow.starts_at`, etc. — all real ISO instants) against a
 * `WorkingHoursRule`'s local wall-clock `starts_time`/`ends_time`
 * (explicitly "interpreted in time_zone" per its own doc comment).
 * `Intl.DateTimeFormat` gives correct IANA timezone conversion for free,
 * built into the JS runtime — this is calendar-date arithmetic, not the
 * geocoding/maps/travel-time work this checkpoint's stop condition
 * excludes.
 */

export interface LocalDateTimeParts {
  /** `YYYY-MM-DD` in `timeZone`. */
  localDate: string;
  /** 0 (Sunday) – 6 (Saturday), in `timeZone`. */
  dayOfWeek: number;
  /** `HH:mm` in `timeZone`. */
  localTime: string;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function resolveLocalDateTime(iso: string, timeZone: string): LocalDateTimeParts {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = get("hour");
  const minute = get("minute");
  if (hour === "24") hour = "00";
  const weekdayShort = get("weekday");

  return {
    localDate: `${year}-${month}-${day}`,
    dayOfWeek: WEEKDAY_INDEX[weekdayShort] ?? date.getUTCDay(),
    localTime: `${hour}:${minute}`,
  };
}
