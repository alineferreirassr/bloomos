import type { WeatherCondition } from "@/types/weather";

/**
 * The one and only WMO weather-code → BloomOS `WeatherCondition` mapping in
 * the codebase. Every caller (current/hourly/daily) must classify through
 * `classifyCondition` below rather than re-deriving this table, per the
 * founder's explicit "use one source of truth" instruction for this phase.
 *
 * Table (WMO code → base condition, before day/night and wind are applied):
 *   0, 1            → SUNNY (day) / NIGHT_CLEAR (night)
 *   2               → PARTLY_CLOUDY
 *   3               → CLOUDY
 *   45, 48          → FOG_MIST
 *   51, 53, 55      → LIGHT_RAIN_DRIZZLE
 *   56, 57          → LIGHT_RAIN_DRIZZLE
 *   61, 63, 65      → RAIN
 *   66, 67          → RAIN
 *   71, 73, 75, 77  → SNOW
 *   80, 81          → RAIN
 *   82              → THUNDERSTORM
 *   85, 86          → SNOW
 *   95, 96, 99      → THUNDERSTORM
 */
const CLEAR_CODES = new Set([0, 1]);
const PARTLY_CLOUDY_CODES = new Set([2]);
const CLOUDY_CODES = new Set([3]);
const FOG_CODES = new Set([45, 48]);
const DRIZZLE_CODES = new Set([51, 53, 55, 56, 57]);
const RAIN_CODES = new Set([61, 63, 65, 66, 67, 80, 81]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const THUNDERSTORM_CODES = new Set([82, 95, 96, 99]);

/** Maps a raw WMO code + day/night flag to a base condition — before the WINDY override is considered. Any WMO code Open-Meteo returns that isn't in the table above falls back to CLOUDY (the safest "something's obscuring the sky" default) rather than throwing, since a forecast provider adding a new code shouldn't crash the Calendar. */
export function baseConditionFromWmoCode(code: number, isDay: boolean): WeatherCondition {
  if (CLEAR_CODES.has(code)) return isDay ? "SUNNY" : "NIGHT_CLEAR";
  if (PARTLY_CLOUDY_CODES.has(code)) return "PARTLY_CLOUDY";
  if (CLOUDY_CODES.has(code)) return "CLOUDY";
  if (FOG_CODES.has(code)) return "FOG_MIST";
  if (DRIZZLE_CODES.has(code)) return "LIGHT_RAIN_DRIZZLE";
  if (RAIN_CODES.has(code)) return "RAIN";
  if (SNOW_CODES.has(code)) return "SNOW";
  if (THUNDERSTORM_CODES.has(code)) return "THUNDERSTORM";
  return "CLOUDY";
}

/**
 * WINDY presentation threshold — UI classification only, per the founder's
 * explicit instruction not to silently invent a safety/cancellation
 * threshold. 20 mph sustained wind is a commonly used consumer-weather-app
 * cutoff for surfacing a "windy" visual (comfortably above normal breezy
 * conditions, comfortably below any advisory-level wind speed a real
 * safety policy would use) — it exists purely so the Weather Pin shows a
 * wind glyph instead of a plain sun/cloud icon when wind is the most
 * notable feature of an otherwise calm day. It carries no operational
 * meaning and must never be read as a cancellation/safety/contractual
 * threshold.
 *
 * WINDY only ever overrides the four "fair weather" base conditions
 * (SUNNY, PARTLY_CLOUDY, CLOUDY, NIGHT_CLEAR). Per the founder's
 * instruction — "If uncertain, keep the underlying weather state and show
 * wind as a secondary indicator instead of overriding the primary state"
 * — RAIN/DRIZZLE/THUNDERSTORM/SNOW/FOG_MIST are never overridden by wind;
 * those conditions are already the more operationally significant signal,
 * and wind speed is always available as a secondary readout regardless of
 * which condition is shown as primary.
 */
export const WINDY_THRESHOLD_MPH = 20;

const WINDY_OVERRIDE_BASE_CONDITIONS = new Set<WeatherCondition>(["SUNNY", "PARTLY_CLOUDY", "CLOUDY", "NIGHT_CLEAR"]);

/** The single entry point every weather-fetching function in this module funnels through. Combines the WMO code, day/night flag, and wind speed into one final `WeatherCondition`. */
export function classifyCondition(code: number, isDay: boolean, windSpeedMph: number): WeatherCondition {
  const base = baseConditionFromWmoCode(code, isDay);
  if (windSpeedMph >= WINDY_THRESHOLD_MPH && WINDY_OVERRIDE_BASE_CONDITIONS.has(base)) {
    return "WINDY";
  }
  return base;
}
