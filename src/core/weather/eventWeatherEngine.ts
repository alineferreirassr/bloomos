import { getDailyForecastForDate, getHourlyForecastNear } from "@/services/weather";
import type { EventWeatherForecast, WeatherPoint, WeatherResult } from "@/types/weather";

/**
 * The minimum slice of `Event` (`src/types/event.ts`) needed to resolve
 * its weather — accepted as a `Pick`-shaped input rather than the full
 * `Event` type so this engine has no dependency on the Events module
 * beyond the field names themselves.
 */
export interface EventWeatherInput {
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  event_date: string | null;
  start_time: string | null;
}

/**
 * Resolves an Event's weather picture — the day's summary always, plus
 * the forecast hour nearest the event's own `start_time` when one is
 * recorded. There is deliberately no "setup" or "breakdown" forecast here:
 * `Event` has no setup/breakdown timestamp fields today, and this engine
 * only ever reports what real data supports (per the founder's explicit
 * "use real data only, do not fabricate missing times" instruction) — a
 * UI wanting those sections must wait until those fields exist upstream.
 */
export async function getEventWeather(event: EventWeatherInput): Promise<WeatherResult<EventWeatherForecast>> {
  if (event.latitude == null || event.longitude == null) {
    return { success: false, error: { reason: "MISSING_COORDINATES", message: "Location needed for weather" } };
  }
  if (!event.event_date) {
    return { success: false, error: { reason: "MISSING_EVENT_DATE", message: "Event date needed for weather" } };
  }

  const point: WeatherPoint = {
    latitude: event.latitude,
    longitude: event.longitude,
    // Open-Meteo resolves timezone from the coordinates themselves when asked for "auto" — used whenever the Event's own `timezone` field is null, so a missing timezone never falls back to server-local or device-local time.
    timezone: event.timezone ?? "auto",
  };

  const dayResult = await getDailyForecastForDate(point, event.event_date);
  if (!dayResult.success) return dayResult;

  let eventTime: EventWeatherForecast["eventTime"] = null;
  if (event.start_time) {
    const targetLocalIso = `${event.event_date}T${event.start_time}:00`;
    const hourlyResult = await getHourlyForecastNear(point, targetLocalIso);
    // An hourly miss doesn't fail the whole lookup — the day summary above already succeeded and is still useful on its own.
    if (hourlyResult.success) eventTime = hourlyResult.data;
  }

  return {
    success: true,
    data: {
      point,
      eventTime,
      day: dayResult.data,
      sunset: dayResult.data.sunset,
    },
  };
}
