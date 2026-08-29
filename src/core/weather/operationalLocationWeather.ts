"use server";

import { getEventWeather } from "@/core/weather/eventWeatherEngine";
import type { OperationalLocation } from "@/core/dashboard/operationalLocation";
import type { DailyForecast } from "@/types/weather";

/**
 * Today's forecast for a fixed operational location (Team's/Client's
 * compact Clock+Weather panel) — deliberately reuses `getEventWeather`,
 * the exact same Open-Meteo-backed engine every event's weather card
 * already calls, rather than a second weather integration. There's no
 * "event" here, so `start_time` is always null (no hourly snapshot is
 * requested, only the day's summary); `event_date` is always today's date
 * in the location's own timezone. Null when the lookup fails — never a
 * fabricated forecast.
 */
export async function getOperationalLocationForecast(location: OperationalLocation): Promise<DailyForecast | null> {
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: location.timezone });
  const result = await getEventWeather({
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: location.timezone,
    event_date: todayIso,
    start_time: null,
  });
  return result.success ? result.data.day : null;
}
