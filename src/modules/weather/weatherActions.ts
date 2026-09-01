"use server";

import { getEventById } from "@/lib/data";
import { getEventWeather } from "@/core/weather/eventWeatherEngine";
import { getDailyForecastForDate } from "@/services/weather";
import type { DailyForecast, EventWeatherForecast } from "@/types/weather";

export type WeatherActionResult<T> = { success: true; data: T } | { success: false; error: string };

/** Client-facing entry point for an Event's weather (`EventDetailView.tsx` is a client component and can't call the server-only weather adapter directly). Wraps `getEventWeather` — never fabricates a forecast for an event missing coordinates or a date, returning the real reason as `error` instead. */
export async function getEventWeatherAction(eventId: string): Promise<WeatherActionResult<EventWeatherForecast>> {
  let event;
  try {
    event = await getEventById(eventId);
  } catch {
    return { success: false, error: "Event not found" };
  }
  const result = await getEventWeather(event);
  if (!result.success) return { success: false, error: result.error.message };
  return { success: true, data: result.data };
}

/**
 * Client-facing entry point for a single calendar day's weather summary —
 * used by the Calendar's Month/Day/Agenda compact indicators, which
 * already carry `latitude`/`longitude`/`timezone` on the `CalendarEvent`
 * they're rendering (populated by `createEventsCalendarSource`) but run
 * inside client components that can't call the server-only weather
 * adapter directly.
 */
export async function getCalendarDayWeatherAction(
  latitude: number,
  longitude: number,
  timezone: string | null,
  date: string
): Promise<WeatherActionResult<DailyForecast>> {
  const result = await getDailyForecastForDate({ latitude, longitude, timezone: timezone ?? "auto" }, date);
  if (!result.success) return { success: false, error: result.error.message };
  return { success: true, data: result.data };
}
