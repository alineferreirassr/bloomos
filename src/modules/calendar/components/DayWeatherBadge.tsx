"use client";

import { useEffect, useState } from "react";
import { WeatherPin } from "@/components/ui/WeatherPin";
import { getCalendarDayWeatherAction } from "@/modules/weather/weatherActions";
import type { DailyForecast } from "@/types/weather";

interface DayWeatherBadgeProps {
  latitude: number;
  longitude: number;
  timezone: string | null;
  /** "YYYY-MM-DD" in the point's own timezone. */
  date: string;
  size?: number;
  className?: string;
}

/**
 * The Calendar's minimal weather touch — a small WeatherPin + high temp,
 * shown only where a specific day already has a real event with
 * coordinates (Selected Day Detail, Day view, Agenda date headers), never
 * per Month cell (per the founder's explicit "keep Month minimal, do not
 * turn Month into a weather calendar" instruction). Fails silently by
 * design: an unavailable forecast simply renders nothing rather than an
 * error chip cluttering a compact calendar row — the Event Workspace's
 * own weather card is where a real "Weather unavailable" message belongs.
 */
export function DayWeatherBadge({ latitude, longitude, timezone, date, size = 18, className = "" }: DayWeatherBadgeProps) {
  const [forecast, setForecast] = useState<DailyForecast | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getCalendarDayWeatherAction(latitude, longitude, timezone, date).then((result) => {
      if (cancelled) return;
      setForecast(result.success ? result.data : null);
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, timezone, date]);

  if (forecast === undefined) {
    return <span className={`inline-block animate-pulse rounded-full bg-text/10 ${className}`} style={{ width: size, height: size }} aria-hidden="true" />;
  }
  if (forecast === null) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <WeatherPin condition={forecast.condition} size={size} />
      <span className="text-xs font-semibold text-text-muted">
        {forecast.highF}°<span className="font-normal opacity-70">/{forecast.lowF}°</span>
      </span>
    </span>
  );
}

/** Finds the first `CalendarEvent`-shaped item in a list that carries real coordinates — the pure helper `DayTimeline`/`AgendaList`/`AdvancedCalendarView` all use to decide whether a day has a weather point to show, never fabricating one when nothing in the list has a location. */
export function findWeatherPoint<T extends { latitude?: number | null; longitude?: number | null; timezone?: string | null }>(
  items: T[]
): { latitude: number; longitude: number; timezone: string | null } | null {
  const match = items.find((item) => item.latitude != null && item.longitude != null);
  if (!match || match.latitude == null || match.longitude == null) return null;
  return { latitude: match.latitude, longitude: match.longitude, timezone: match.timezone ?? null };
}
