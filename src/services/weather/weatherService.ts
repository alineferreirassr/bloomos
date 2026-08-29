import { cache } from "react";
import { fetchOpenMeteoForecast, OpenMeteoRequestError, type OpenMeteoForecastResponse } from "@/services/weather/openMeteoClient";
import { classifyCondition } from "@/services/weather/wmoMapping";
import type { WeatherPoint, WeatherSnapshot, DailyForecast, WeatherResult, WeatherError } from "@/types/weather";

/**
 * The reusable server-side weather adapter — every module (Calendar,
 * Event Workspace, Founder/Team dashboards) calls the three functions
 * exported here (`getCurrentWeather`, `getDailyForecast`,
 * `getHourlyForecast`) rather than talking to Open-Meteo or parsing WMO
 * codes itself. Server-only: relies on `fetch`'s Next.js caching extension
 * and `react`'s request-scoped `cache()`, neither of which exist in a
 * client bundle — only import this from Server Components/Actions.
 *
 * Caching: 30-minute revalidate window. Open-Meteo's underlying forecast
 * models update on the order of once an hour; 30 minutes keeps the data
 * meaningfully fresh (a Founder checking weather twice in a morning sees
 * an update, not a stale number) without re-fetching on every request —
 * well inside Open-Meteo's free/non-commercial usage guidance. `cache()`
 * additionally dedupes identical point+range lookups within one render
 * pass (e.g. a dashboard rendering both a Calendar weather chip and a
 * Founder weather card for the same event in one page load only issues
 * one Open-Meteo request).
 */
const CACHE_REVALIDATE_SECONDS = 1800;

const CURRENT_FIELDS = ["temperature_2m", "weather_code", "wind_speed_10m", "wind_direction_10m", "is_day"];
const HOURLY_FIELDS = ["temperature_2m", "weather_code", "precipitation_probability", "wind_speed_10m", "wind_direction_10m", "is_day"];
const DAILY_FIELDS = ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max", "wind_speed_10m_max", "sunrise", "sunset"];

function providerErrorResult(err: unknown): WeatherError {
  if (err instanceof OpenMeteoRequestError) {
    return { reason: "PROVIDER_ERROR", message: "Weather provider error" };
  }
  return { reason: "UNAVAILABLE", message: "Weather unavailable" };
}

function missingCoordinatesResult(): WeatherResult<never> {
  return { success: false, error: { reason: "MISSING_COORDINATES", message: "Location needed for weather" } };
}

/**
 * One combined Open-Meteo request (current + hourly + daily) per distinct
 * point, memoized for the current render pass via `react`'s `cache()` —
 * `getCurrentWeather`/`getDailyForecast`/`getHourlyForecast` all slice
 * their answer out of this single response instead of issuing separate
 * requests, so a page that needs more than one "mode" for the same point
 * still only calls Open-Meteo once.
 */
const fetchCombinedForecast = cache(async (latitude: number, longitude: number, timezone: string): Promise<OpenMeteoForecastResponse> => {
  return fetchOpenMeteoForecast(
    {
      latitude,
      longitude,
      timezone,
      current: CURRENT_FIELDS,
      hourly: HOURLY_FIELDS,
      daily: DAILY_FIELDS,
    },
    CACHE_REVALIDATE_SECONDS
  );
});

function toDailyForecast(response: OpenMeteoForecastResponse, index: number): DailyForecast {
  const daily = response.daily!;
  const code = daily.weather_code[index];
  const sunrise = daily.sunrise[index];
  const sunset = daily.sunset[index];
  return {
    date: daily.time[index],
    // A day-level summary has no single "moment" to test day/night against — always classified as daytime, matching how every consumer weather service treats a daily forecast card.
    condition: classifyCondition(code, true, daily.wind_speed_10m_max[index]),
    weatherCode: code,
    highF: Math.round(daily.temperature_2m_max[index]),
    lowF: Math.round(daily.temperature_2m_min[index]),
    precipitationProbabilityMax: daily.precipitation_probability_max[index] ?? null,
    windSpeedMaxMph: Math.round(daily.wind_speed_10m_max[index]),
    sunrise,
    sunset,
  };
}

function toHourlySnapshot(response: OpenMeteoForecastResponse, index: number): WeatherSnapshot {
  const hourly = response.hourly!;
  const code = hourly.weather_code[index];
  const isDay = hourly.is_day[index] === 1;
  const windSpeed = hourly.wind_speed_10m[index];
  return {
    time: hourly.time[index],
    condition: classifyCondition(code, isDay, windSpeed),
    weatherCode: code,
    temperatureF: Math.round(hourly.temperature_2m[index]),
    precipitationProbability: hourly.precipitation_probability[index] ?? null,
    windSpeedMph: Math.round(windSpeed),
    windDirectionDeg: hourly.wind_direction_10m[index] ?? null,
    isDay,
  };
}

async function fetchForPoint(point: WeatherPoint): Promise<WeatherResult<OpenMeteoForecastResponse>> {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return missingCoordinatesResult();
  try {
    const response = await fetchCombinedForecast(point.latitude, point.longitude, point.timezone);
    return { success: true, data: response };
  } catch (err) {
    return { success: false, error: providerErrorResult(err) };
  }
}

/** CURRENT/TODAY — the current instant's weather, taken from Open-Meteo's own `current` block (its own `is_day` flag, computed in the requested timezone — see `wmoMapping.ts` for why this beats hand-rolled sunrise/sunset math). */
export async function getCurrentWeather(point: WeatherPoint): Promise<WeatherResult<WeatherSnapshot>> {
  const result = await fetchForPoint(point);
  if (!result.success) return result;
  const current = result.data.current;
  if (!current) return { success: false, error: { reason: "UNAVAILABLE", message: "Weather unavailable" } };
  return {
    success: true,
    data: {
      time: current.time,
      condition: classifyCondition(current.weather_code, current.is_day === 1, current.wind_speed_10m),
      weatherCode: current.weather_code,
      temperatureF: Math.round(current.temperature_2m),
      precipitationProbability: null,
      windSpeedMph: Math.round(current.wind_speed_10m),
      windDirectionDeg: current.wind_direction_10m,
      isDay: current.is_day === 1,
    },
  };
}

/** DAILY FORECAST — every day Open-Meteo returns within its horizon (up to 16 days out). */
export async function getDailyForecast(point: WeatherPoint): Promise<WeatherResult<DailyForecast[]>> {
  const result = await fetchForPoint(point);
  if (!result.success) return result;
  const daily = result.data.daily;
  if (!daily) return { success: false, error: { reason: "UNAVAILABLE", message: "Weather unavailable" } };
  return { success: true, data: daily.time.map((_, index) => toDailyForecast(result.data, index)) };
}

/** One specific calendar day's summary — used by Calendar's Month/Agenda/Day-detail integrations and by `eventWeatherEngine`. Returns `FORECAST_OUT_OF_RANGE` when `date` (a "YYYY-MM-DD" string in the point's own timezone) falls outside what Open-Meteo returned, rather than fabricating one. */
export async function getDailyForecastForDate(point: WeatherPoint, date: string): Promise<WeatherResult<DailyForecast>> {
  const result = await getDailyForecast(point);
  if (!result.success) return result;
  const match = result.data.find((day) => day.date === date);
  if (!match) return { success: false, error: { reason: "FORECAST_OUT_OF_RANGE", message: "Forecast not available yet" } };
  return { success: true, data: match };
}

/** HOURLY FORECAST — every hour Open-Meteo returns within its horizon. */
export async function getHourlyForecast(point: WeatherPoint): Promise<WeatherResult<WeatherSnapshot[]>> {
  const result = await fetchForPoint(point);
  if (!result.success) return result;
  const hourly = result.data.hourly;
  if (!hourly) return { success: false, error: { reason: "UNAVAILABLE", message: "Weather unavailable" } };
  return { success: true, data: hourly.time.map((_, index) => toHourlySnapshot(result.data, index)) };
}

/**
 * The hourly forecast point nearest a target local datetime (an event's
 * `event_date` + `start_time` combined into an ISO-ish string in the
 * point's own timezone) — used by `eventWeatherEngine` to answer "what
 * will the weather be at the event's actual start time". Returns
 * `FORECAST_OUT_OF_RANGE` when the target falls entirely outside the
 * returned hourly series (further out than Open-Meteo's horizon, or in
 * the past beyond what it retains).
 */
export async function getHourlyForecastNear(point: WeatherPoint, targetLocalIso: string): Promise<WeatherResult<WeatherSnapshot>> {
  const result = await getHourlyForecast(point);
  if (!result.success) return result;
  const targetMs = new Date(targetLocalIso).getTime();
  if (!Number.isFinite(targetMs) || result.data.length === 0) {
    return { success: false, error: { reason: "FORECAST_OUT_OF_RANGE", message: "Forecast not available yet" } };
  }
  let nearest = result.data[0];
  let smallestDiff = Math.abs(new Date(nearest.time).getTime() - targetMs);
  for (const point_ of result.data) {
    const diff = Math.abs(new Date(point_.time).getTime() - targetMs);
    if (diff < smallestDiff) {
      nearest = point_;
      smallestDiff = diff;
    }
  }
  // More than 36 hours from the nearest available point means the target genuinely isn't covered by this forecast (e.g. an event 3 weeks out) — report it honestly rather than silently returning a distant, misleading hour.
  const THIRTY_SIX_HOURS_MS = 36 * 60 * 60 * 1000;
  if (smallestDiff > THIRTY_SIX_HOURS_MS) {
    return { success: false, error: { reason: "FORECAST_OUT_OF_RANGE", message: "Forecast not available yet" } };
  }
  return { success: true, data: nearest };
}
