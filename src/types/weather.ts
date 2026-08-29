/**
 * The ten BloomOS weather states the Amoré Bloom Weather Pin renders.
 * Every WMO weather code Open-Meteo returns funnels through exactly one
 * mapping function (`src/services/weather/wmoMapping.ts`) into one of
 * these — no component or module re-derives this classification.
 */
export type WeatherCondition =
  | "SUNNY"
  | "PARTLY_CLOUDY"
  | "CLOUDY"
  | "RAIN"
  | "LIGHT_RAIN_DRIZZLE"
  | "THUNDERSTORM"
  | "SNOW"
  | "FOG_MIST"
  | "WINDY"
  | "NIGHT_CLEAR";

/** A location + timezone pair, the minimum Open-Meteo needs for any request. Timezone is an IANA string (e.g. "America/Los_Angeles") or the literal "auto" to let Open-Meteo resolve it from the coordinates. */
export interface WeatherPoint {
  latitude: number;
  longitude: number;
  timezone: string;
}

/** One resolved forecast instant — the shared shape "current weather" and each hourly point both reduce to. */
export interface WeatherSnapshot {
  /** ISO datetime in the point's own timezone (never converted to server-local or device-local time). */
  time: string;
  condition: WeatherCondition;
  /** The raw WMO code this snapshot's condition was classified from, kept for debugging/tests. */
  weatherCode: number;
  temperatureF: number;
  precipitationProbability: number | null;
  windSpeedMph: number;
  windDirectionDeg: number | null;
  isDay: boolean;
}

/** One calendar day's summary, as used by Month/Agenda's compact indicators and Founder/Event cards. */
export interface DailyForecast {
  /** "YYYY-MM-DD" in the point's own timezone. */
  date: string;
  condition: WeatherCondition;
  weatherCode: number;
  highF: number;
  lowF: number;
  precipitationProbabilityMax: number | null;
  windSpeedMaxMph: number;
  /** ISO datetime in the point's own timezone. */
  sunrise: string;
  /** ISO datetime in the point's own timezone. */
  sunset: string;
}

/**
 * An Event's own weather picture. Only ever carries what real Event data
 * supports — `Event` (`src/types/event.ts`) has `event_date`/`start_time`/
 * `end_time` but no setup/breakdown timestamp fields, so this type has no
 * `setup`/`breakdown` slots to fabricate; a UI that wants "Setup ·" or
 * "Breakdown ·" rows must wait until those fields exist upstream.
 */
export interface EventWeatherForecast {
  point: WeatherPoint;
  /** The forecast hour nearest the event's own `start_time`, or null when the event has no `start_time` to pin one to (falls back to `day` alone). */
  eventTime: WeatherSnapshot | null;
  /** The event date's daily summary — always present when the event date is within the provider's forecast horizon. */
  day: DailyForecast | null;
  /** Convenience copy of `day.sunset`, since "Sunset 7:31 PM" is a common display line next to `eventTime`. */
  sunset: string | null;
}

/** Every way a weather lookup can fail to produce data — always reported, never silently swallowed into a blank card. */
export type WeatherErrorReason =
  | "MISSING_COORDINATES"
  | "MISSING_EVENT_DATE"
  | "FORECAST_OUT_OF_RANGE"
  | "PROVIDER_ERROR"
  | "UNAVAILABLE";

export interface WeatherError {
  reason: WeatherErrorReason;
  /** Short, founder/team-facing copy — e.g. "Location needed for weather". Never a raw provider error string. */
  message: string;
}

export type WeatherResult<T> = { success: true; data: T } | { success: false; error: WeatherError };

/** Human-readable label for each `WeatherCondition` — the single source every UI surface (WeatherPin's `aria-label`, Event/Calendar/Dashboard weather text) reads from, rather than each component hand-writing its own copy. */
export const WEATHER_CONDITION_LABEL: Record<WeatherCondition, string> = {
  SUNNY: "Sunny",
  PARTLY_CLOUDY: "Partly Cloudy",
  CLOUDY: "Cloudy",
  RAIN: "Rain",
  LIGHT_RAIN_DRIZZLE: "Light Rain",
  THUNDERSTORM: "Thunderstorm",
  SNOW: "Snow",
  FOG_MIST: "Fog",
  WINDY: "Windy",
  NIGHT_CLEAR: "Clear",
};
