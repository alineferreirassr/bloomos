/**
 * The one place BloomOS talks to Open-Meteo's HTTP API. No API key, no
 * account — Open-Meteo's free, non-commercial forecast endpoint. Every
 * other file in `services/weather/` and `core/weather/` goes through this
 * client rather than calling `fetch` directly, per the founder's explicit
 * "don't scatter raw Open-Meteo calls across UI components" instruction.
 */
const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Open-Meteo's forecast horizon tops out at 16 days; requesting further ahead than that returns no daily data for the missing days rather than an error, so callers must check for it themselves (see `weatherService.ts`'s FORECAST_OUT_OF_RANGE handling). */
export const OPEN_METEO_MAX_FORECAST_DAYS = 16;

export interface OpenMeteoCurrentBlock {
  time: string;
  temperature_2m: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  is_day: number;
}

export interface OpenMeteoHourlyBlock {
  time: string[];
  temperature_2m: number[];
  weather_code: number[];
  precipitation_probability: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  is_day: number[];
}

export interface OpenMeteoDailyBlock {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  sunrise: string[];
  sunset: string[];
}

export interface OpenMeteoForecastResponse {
  timezone: string;
  current?: OpenMeteoCurrentBlock;
  hourly?: OpenMeteoHourlyBlock;
  daily?: OpenMeteoDailyBlock;
}

export interface OpenMeteoRequestParams {
  latitude: number;
  longitude: number;
  /** IANA timezone string, or "auto" to let Open-Meteo resolve it from the coordinates (used whenever an Event's own `timezone` field is null). */
  timezone: string;
  current?: string[];
  hourly?: string[];
  daily?: string[];
  forecastDays?: number;
}

/** Thrown for any non-2xx Open-Meteo response; callers convert this into a `WeatherError` with reason `"PROVIDER_ERROR"` rather than letting it propagate raw. */
export class OpenMeteoRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "OpenMeteoRequestError";
  }
}

/**
 * Issues one Open-Meteo forecast request. `revalidateSeconds` drives
 * Next.js's fetch cache directly (see `weatherService.ts` for the chosen
 * durations and rationale) — this function never decides caching policy
 * itself, only accepts it as a parameter, so every caller's cache duration
 * stays visible at its own call site.
 */
export async function fetchOpenMeteoForecast(params: OpenMeteoRequestParams, revalidateSeconds: number): Promise<OpenMeteoForecastResponse> {
  const url = new URL(OPEN_METEO_FORECAST_URL);
  url.searchParams.set("latitude", String(params.latitude));
  url.searchParams.set("longitude", String(params.longitude));
  url.searchParams.set("timezone", params.timezone);
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("forecast_days", String(params.forecastDays ?? OPEN_METEO_MAX_FORECAST_DAYS));
  if (params.current?.length) url.searchParams.set("current", params.current.join(","));
  if (params.hourly?.length) url.searchParams.set("hourly", params.hourly.join(","));
  if (params.daily?.length) url.searchParams.set("daily", params.daily.join(","));

  const response = await fetch(url.toString(), { next: { revalidate: revalidateSeconds } });
  if (!response.ok) {
    throw new OpenMeteoRequestError(response.status, `Open-Meteo request failed with status ${response.status}`);
  }
  return (await response.json()) as OpenMeteoForecastResponse;
}
