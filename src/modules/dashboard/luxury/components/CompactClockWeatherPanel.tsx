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
 * Team + Client Compact Density Pass — the Founder's own accepted
 * `WorldClockCard` city clock renders at 84px; this pair has only one
 * location instead of three, so a modest bump (not the previous 92px)
 * keeps it reading as "daily context," never larger/more dominant than
 * the Founder Dashboard's own frozen reference.
 *
 * "Responsive Desktop-Parity Refinement" checkpoint — these are now the
 * DESKTOP (lg:) sizes only. The illustrations shrink at narrower widths via
 * responsive `className` overrides on the SVG (CSS width/height beats the
 * SVG's own `width`/`height` presentation attributes), never a global
 * `transform: scale()` on the card — see the JSX below for the mobile/
 * tablet tiers.
 */
const CLOCK_FACE_SIZE = 84;
const WEATHER_PIN_SIZE = 76;

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
    <div className="grid grid-cols-[44fr_56fr] gap-1.5 sm:gap-3 lg:grid-cols-[1fr_1.2fr] lg:gap-4">
      <LuxuryCard tone="page" padding="compact" className="flex min-w-0 flex-col items-center justify-center text-center shadow-luxury-sm transition-shadow duration-150 hover:shadow-luxury-md lg:px-4 lg:py-2">
        {display ? (
          <>
            <AnalogClockFace hour24={display.hour24} minute={display.minute} size={CLOCK_FACE_SIZE} className="h-14 w-14 sm:h-[72px] sm:w-[72px] lg:h-[84px] lg:w-[84px]" />
            <p className="mt-1 font-luxury-display text-luxury-small leading-tight font-semibold text-luxury-text sm:text-lg">{location.city}</p>
            <p className="text-luxury-status font-medium tracking-[0.1em] text-luxury-text-muted uppercase sm:text-luxury-metadata sm:tracking-[0.14em]">{location.region}</p>
            <p className="mt-1 font-luxury-display text-2xl leading-none font-semibold text-luxury-text sm:text-3xl">{display.timeLabel}</p>
            <p className="mt-0.5 text-luxury-status text-luxury-text-muted sm:text-luxury-small">{display.dateLabel}</p>
            <span className="mt-1 flex items-center gap-1 text-luxury-status font-semibold tracking-[0.1em] text-luxury-rose uppercase">
              <DayPeriodGlyph isNight={display.isNight} />
              {display.dayPeriod}
            </span>
          </>
        ) : (
          <div className="h-[9rem] w-full rounded-luxury-md" aria-hidden="true" />
        )}
      </LuxuryCard>

      <LuxuryCard tone="surface" padding="compact" className="flex min-w-0 flex-col justify-center gap-1.5 shadow-luxury-sm transition-shadow duration-150 hover:shadow-luxury-md lg:px-4 lg:py-2">
        <SectionHeader
          title="♡ Weather"
          action={
            <span className="flex items-center gap-1 text-luxury-status font-medium text-luxury-rose sm:text-luxury-small">
              <LocationPinGlyph />
              <span className="hidden sm:inline">{location.city}</span>
            </span>
          }
        />
        {forecast ? (
          <>
            <div className="flex items-center gap-2 sm:gap-3">
              <WeatherPin condition={forecast.condition} size={WEATHER_PIN_SIZE} className="h-[54px] w-[45px] sm:h-[77px] sm:w-[64px] lg:h-[91px] lg:w-[76px]" />
              <div className="min-w-0">
                <p className="font-luxury-display text-luxury-page leading-none font-semibold text-luxury-text sm:text-luxury-display">{forecast.highF}°</p>
                <p className="mt-0.5 text-luxury-small text-luxury-text-muted sm:text-luxury-body">{WEATHER_CONDITION_LABEL[forecast.condition]}</p>
              </div>
              <div className="ml-auto shrink-0 text-right">
                <p className="text-luxury-status font-medium tabular-nums text-luxury-text sm:text-luxury-small">H {forecast.highF}°</p>
                <p className="text-luxury-status font-medium tabular-nums text-luxury-text-muted sm:text-luxury-small">L {forecast.lowF}°</p>
              </div>
            </div>
            {hasMetrics ? (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 border-t border-luxury-border pt-1.5 text-luxury-status sm:gap-x-4 sm:text-luxury-small">
                {forecast.precipitationProbabilityMax !== null ? (
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <Droplets className="size-3 shrink-0 text-luxury-rose sm:size-3.5" aria-hidden="true" />
                    <span className="text-luxury-text-muted">Precip</span>
                    <span className="ml-auto font-medium tabular-nums text-luxury-text">{forecast.precipitationProbabilityMax}%</span>
                  </div>
                ) : null}
                {forecast.windSpeedMaxMph !== null ? (
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <Wind className="size-3 shrink-0 text-luxury-rose sm:size-3.5" aria-hidden="true" />
                    <span className="text-luxury-text-muted">Wind</span>
                    <span className="ml-auto font-medium tabular-nums text-luxury-text">{Math.round(forecast.windSpeedMaxMph)} mph</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-luxury-status text-luxury-text-muted sm:text-luxury-small">Weather is unavailable for {location.city} right now.</p>
        )}
      </LuxuryCard>
    </div>
  );
}
