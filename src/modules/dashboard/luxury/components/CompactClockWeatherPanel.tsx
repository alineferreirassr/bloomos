"use client";

import { useEffect, useState } from "react";
import { Droplets, Wind } from "lucide-react";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { AnalogClockFace } from "@/modules/dashboard/luxury/components/AnalogClockFace";
import { DayPeriodGlyph } from "@/modules/dashboard/luxury/components/DayPeriodGlyph";
import { LocationPinGlyph } from "@/modules/dashboard/luxury/components/LocationPinGlyph";
import { WeatherPin } from "@/components/ui/WeatherPin";
import { buildWorldClockDisplay } from "@/modules/dashboard/luxury/worldClock";
import type { OperationalLocation } from "@/core/dashboard/operationalLocation";
import { WEATHER_CONDITION_LABEL, type DailyForecast } from "@/types/weather";

const REFRESH_INTERVAL_MS = 30_000;
/**
 * Team + Client Composition Correction — the Founder's own accepted
 * `WorldClockCard` city clock renders at 84px; this pair has only one
 * location instead of three, so a modest bump (not the previous 124px)
 * keeps it reading as "daily context," never larger/more dominant than
 * the Founder Dashboard's own frozen reference.
 */
const CLOCK_FACE_SIZE = 92;
const WEATHER_PIN_SIZE = 84;

interface CompactClockWeatherPanelProps {
  location: OperationalLocation;
  /** Today's forecast at `location` — null when the lookup failed, never fabricated. */
  forecast: DailyForecast | null;
}

/**
 * "Team + Client Compact Clock & Weather Variant" addendum, then several
 * visual-correction passes — the shared single-location Clock+Weather pair
 * Team (`/team`) and the Client portal (`/client-access`) both render, as
 * opposed to Founder Dashboard's multi-city `WorldClockCard`.
 *
 * Team + Client Composition Correction — the Founder Dashboard is now
 * frozen/accepted as-is (not touched by this pass); this component had
 * grown visually larger and more dominant than that accepted reference
 * (a bigger clock, a bigger pin, taller padding, an asymmetric 11fr/9fr
 * grid). Reduced across the board — smaller illustrations, compact
 * padding, a plain 2-up grid, and city/time typography no larger than
 * the Founder city card's own — so Team/Client read as "daily context"
 * widgets, not the page's main feature.
 *
 * Clock keeps `tone="page"` (AF's own single-location clock card uses
 * `bg-ivory`, the same value as the page body) and Weather keeps
 * `tone="surface"` (AF's `WeatherCard` uses `bg-surface`) — the two
 * aren't byte-identical in AF either, they belong to one family through
 * shared radius/border/shadow, not an enforced identical fill.
 */
export function CompactClockWeatherPanel({ location, forecast }: CompactClockWeatherPanelProps) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same hydration-safe "commit the real client-only value on mount" exception as WorldClockCard's own effect.
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const asWorldClockLocation = { id: "operational", city: location.city, region: location.region, timezone: location.timezone };
  const display = now ? buildWorldClockDisplay(now, asWorldClockLocation, asWorldClockLocation) : null;
  const hasMetrics = forecast !== null && (forecast.precipitationProbabilityMax !== null || forecast.windSpeedMaxMph !== null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <LuxuryCard tone="page" className="flex flex-col items-center justify-center gap-0.5 px-5 py-4 text-center shadow-luxury-sm transition-shadow duration-150 hover:shadow-luxury-md">
        {display ? (
          <>
            <AnalogClockFace hour24={display.hour24} minute={display.minute} size={CLOCK_FACE_SIZE} />
            <p className="mt-2 font-luxury-display text-lg leading-tight font-semibold text-luxury-text">{location.city}</p>
            <p className="text-luxury-metadata font-medium tracking-[0.14em] text-luxury-text-muted uppercase">{location.region}</p>
            <p className="mt-2 font-luxury-display text-3xl leading-none font-semibold text-luxury-text">{display.timeLabel}</p>
            <p className="mt-1 text-luxury-small text-luxury-text-muted">{display.dateLabel}</p>
            <span className="mt-1.5 flex items-center gap-1 text-luxury-status font-semibold tracking-[0.1em] text-luxury-rose uppercase">
              <DayPeriodGlyph isNight={display.isNight} />
              {display.dayPeriod}
            </span>
          </>
        ) : (
          <div className="h-[12rem] w-full rounded-luxury-md" aria-hidden="true" />
        )}
      </LuxuryCard>

      <LuxuryCard tone="surface" className="flex flex-col justify-center gap-2 px-5 py-4 shadow-luxury-sm transition-shadow duration-150 hover:shadow-luxury-md">
        <SectionHeader
          title="♡ Weather"
          action={
            <span className="flex items-center gap-1 text-luxury-small font-medium text-luxury-rose">
              <LocationPinGlyph />
              {location.city}
            </span>
          }
        />
        {forecast ? (
          <>
            <div className="flex items-center gap-3">
              <WeatherPin condition={forecast.condition} size={WEATHER_PIN_SIZE} />
              <div className="min-w-0">
                <p className="font-luxury-display text-luxury-display leading-none font-semibold text-luxury-text">{forecast.highF}°</p>
                <p className="mt-1 text-luxury-body text-luxury-text-muted">{WEATHER_CONDITION_LABEL[forecast.condition]}</p>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <p className="text-luxury-small font-medium tabular-nums text-luxury-text">H {forecast.highF}°</p>
                <p className="text-luxury-small font-medium tabular-nums text-luxury-text-muted">L {forecast.lowF}°</p>
              </div>
            </div>
            {hasMetrics ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-luxury-border pt-2 text-luxury-small">
                {forecast.precipitationProbabilityMax !== null ? (
                  <div className="flex items-center gap-1.5">
                    <Droplets className="size-3.5 shrink-0 text-luxury-rose" aria-hidden="true" />
                    <span className="text-luxury-text-muted">Precip</span>
                    <span className="ml-auto font-medium tabular-nums text-luxury-text">{forecast.precipitationProbabilityMax}%</span>
                  </div>
                ) : null}
                {forecast.windSpeedMaxMph !== null ? (
                  <div className="flex items-center gap-1.5">
                    <Wind className="size-3.5 shrink-0 text-luxury-rose" aria-hidden="true" />
                    <span className="text-luxury-text-muted">Wind</span>
                    <span className="ml-auto font-medium tabular-nums text-luxury-text">{Math.round(forecast.windSpeedMaxMph)} mph</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-luxury-small text-luxury-text-muted">Weather is unavailable for {location.city} right now.</p>
        )}
      </LuxuryCard>
    </div>
  );
}
