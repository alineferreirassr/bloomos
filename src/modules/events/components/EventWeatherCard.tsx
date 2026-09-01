"use client";

import { useEffect, useState } from "react";
import { WeatherPin } from "@/components/ui/WeatherPin";
import { getEventWeatherAction } from "@/modules/weather/weatherActions";
import { WEATHER_CONDITION_LABEL } from "@/types/weather";
import type { EventWeatherForecast } from "@/types/weather";

interface EventWeatherCardProps {
  eventId: string;
}

type State = { status: "loading" } | { status: "unavailable"; message: string } | { status: "ready"; data: EventWeatherForecast };

/**
 * The Event Workspace's weather card — the richest weather surface in
 * BloomOS, per the founder's "weather should be most useful inside an
 * Event context" instruction. Shows the forecast hour nearest the event's
 * own `start_time` when one is recorded, falling back to the day's
 * summary alone when it isn't; there is no "Setup"/"Breakdown" section
 * because `Event` has no setup/breakdown timestamp fields to build one
 * from honestly (see `eventWeatherEngine.ts`'s doc comment) — a known
 * limitation, not an oversight.
 */
export function EventWeatherCard({ eventId }: EventWeatherCardProps) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getEventWeatherAction(eventId).then((result) => {
      if (cancelled) return;
      setState(result.success ? { status: "ready", data: result.data } : { status: "unavailable", message: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <div className="rounded-luxury-lg bg-luxury-surface p-5 shadow-luxury-sm">
      <h3 className="font-serif text-[17px] font-semibold text-text">Weather</h3>
      <div className="mt-3">
        {state.status === "loading" ? (
          <div className="h-16 animate-pulse rounded-md bg-text/5" aria-hidden="true" />
        ) : state.status === "unavailable" ? (
          <p className="text-sm text-text-muted">{state.message}</p>
        ) : (
          <EventWeatherContent data={state.data} />
        )}
      </div>
    </div>
  );
}

function EventWeatherContent({ data }: { data: EventWeatherForecast }) {
  const { eventTime, day, sunset } = data;

  if (!eventTime && !day) {
    return <p className="text-sm text-text-muted">Weather unavailable</p>;
  }

  if (eventTime) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <WeatherPin condition={eventTime.condition} size={48} />
        <div>
          <p className="text-2xl font-semibold text-text">{eventTime.temperatureF}°F</p>
          <p className="text-sm text-text-muted">{WEATHER_CONDITION_LABEL[eventTime.condition]}</p>
        </div>
        <div className="ml-auto flex flex-col items-end gap-1 text-xs text-text-muted">
          {eventTime.precipitationProbability != null ? <span>Rain {eventTime.precipitationProbability}%</span> : null}
          <span>Wind {eventTime.windSpeedMph} mph</span>
          {sunset ? <span>Sunset {new Date(sunset).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <WeatherPin condition={day!.condition} size={48} />
      <div>
        <p className="text-2xl font-semibold text-text">
          {day!.highF}° / {day!.lowF}°F
        </p>
        <p className="text-sm text-text-muted">{WEATHER_CONDITION_LABEL[day!.condition]}</p>
      </div>
      <div className="ml-auto flex flex-col items-end gap-1 text-xs text-text-muted">
        <span>Wind {day!.windSpeedMaxMph} mph</span>
        {sunset ? <span>Sunset {new Date(sunset).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span> : null}
      </div>
    </div>
  );
}
