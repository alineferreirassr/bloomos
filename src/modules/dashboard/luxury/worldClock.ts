/**
 * Pure, dependency-free world-clock math — every displayed value is derived
 * from a real `Date` instant plus the IANA timezone database already built
 * into the JS runtime (`Intl`), never a static/hard-coded time string and
 * never a third-party timezone API. `getUtcOffsetMinutes` reads the same
 * instant's offset in two timezones and subtracts them, which is the only
 * reliable way to express "N hours from Honolulu" across a DST boundary
 * (California observes it, Hawaii and São Paulo do not) — a fixed offset
 * table would silently go stale twice a year.
 */

export interface WorldClockLocation {
  id: string;
  city: string;
  region: string;
  /** IANA timezone identifier — the only thing that ever selects a location's time; never a raw UTC offset. */
  timezone: string;
}

/** The three locations the Founder specified, in display order. Honolulu is the fixed reference point every other card's relative-offset line is computed against — matching the brief's own worked example exactly (Huntington Beach "+3h", Sorocaba "+7h" from Honolulu). */
export const WORLD_CLOCK_LOCATIONS: readonly WorldClockLocation[] = [
  { id: "honolulu", city: "Honolulu", region: "Hawaii, United States", timezone: "Pacific/Honolulu" },
  { id: "huntington-beach", city: "Huntington Beach", region: "California, United States", timezone: "America/Los_Angeles" },
  { id: "sorocaba", city: "Sorocaba", region: "São Paulo, Brazil", timezone: "America/Sao_Paulo" },
];

export const WORLD_CLOCK_HOME_LOCATION_ID = "honolulu";

export type DayPeriod = "Morning" | "Afternoon" | "Evening" | "Night";

/** Buckets the location's own local hour (0-23) into a coarse day-period label — the "contextual day/night state" the brief asks for. Deliberately simple (no real sunrise/sunset lookup for these three fixed cities, unlike the event-weather engine's astronomical data, which only exists for actual event coordinates) rather than fabricating precision the app doesn't have. */
export function dayPeriodForHour(hour: number): DayPeriod {
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

export function isNightHour(hour: number): boolean {
  return hour < 6 || hour >= 20;
}

/** The UTC offset, in minutes, a given timezone observes at a given instant — DST-correct because it's read fresh from `Intl` for that exact `date`, never cached or hard-coded. */
export function getUtcOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(date);
  const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+0";
  const match = offsetPart.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

export interface WorldClockDisplay {
  locationId: string;
  city: string;
  region: string;
  /** e.g. "7:24 PM" */
  timeLabel: string;
  /** e.g. "Fri, Aug 28" */
  dateLabel: string;
  dayPeriod: DayPeriod;
  isNight: boolean;
  /** Null only for the home location itself — every other card gets a real, signed hour offset from it. */
  hoursFromHome: number | null;
  isHome: boolean;
  /** The location's own real local hour (0-23) and minute — exposed specifically so `AnalogClockFace` can point its hands at the actual time rather than a decorative fixed position. */
  hour24: number;
  minute: number;
}

/** Builds every displayed field for one location from one shared `Date` instant, so all three cards in a render are always mutually consistent (no risk of reading `Date.now()` three separate times and getting skewed values). */
export function buildWorldClockDisplay(date: Date, location: WorldClockLocation, homeLocation: WorldClockLocation): WorldClockDisplay {
  const timeLabel = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  const dateLabel = new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, weekday: "short", month: "short", day: "numeric" }).format(date);
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "numeric", hour12: false }).format(date).replace("24", "0"));
  const minute = Number(new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, minute: "numeric" }).format(date));
  const isHome = location.id === homeLocation.id;
  const hoursFromHome = isHome ? null : Math.round((getUtcOffsetMinutes(date, location.timezone) - getUtcOffsetMinutes(date, homeLocation.timezone)) / 60);

  return {
    locationId: location.id,
    city: location.city,
    region: location.region,
    timeLabel,
    dateLabel,
    hour24: hour,
    minute,
    dayPeriod: dayPeriodForHour(hour),
    isNight: isNightHour(hour),
    hoursFromHome,
    isHome,
  };
}

export function buildWorldClockDisplays(date: Date, locations: readonly WorldClockLocation[] = WORLD_CLOCK_LOCATIONS, homeLocationId: string = WORLD_CLOCK_HOME_LOCATION_ID): WorldClockDisplay[] {
  const homeLocation = locations.find((location) => location.id === homeLocationId) ?? locations[0];
  return locations.map((location) => buildWorldClockDisplay(date, location, homeLocation));
}
