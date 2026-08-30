"use client";

import { useEffect, useState } from "react";
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
const CLOCK_FACE_SIZE = 126;
const WEATHER_PIN_SIZE = 100;

interface CompactClockWeatherPanelProps {
  location: OperationalLocation;
  /** Today's forecast at `location` — null when the lookup failed, never fabricated. */
  forecast: DailyForecast | null;
}

/**
 * "Team + Client Compact Clock & Weather Variant" addendum, then the
 * Founder's visual-rejection correction, then the "Team Aesthetic Clock +
 * Weather" tightening pass — the shared single-location Clock+Weather pair
 * Team (`/team`) and the Client portal (`/client-access`) both render, as
 * opposed to Founder Dashboard's multi-city `WorldClockCard`. Deliberately
 * reuses the exact same illustrated pieces that card and
 * `NextEventWeatherCard` already established (`AnalogClockFace`'s
 * gold-ring/bow/heart SVG with real computed hand angles, `WeatherPin`'s
 * blush/gold/wine illustration, `buildWorldClockDisplay`'s IANA-timezone
 * math, the same Luxury card/section-header shell/tokens) rather than a
 * parallel implementation or a new palette. Both illustrations render large
 * (still the identical SVGs WorldClockCard/NextEventWeatherCard ship) so
 * their gold-rim/bow/heart/gradient detail reads at a glance; the two cards
 * share identical padding/radius/shadow/tone so they read as one matched
 * pair, and vertical padding/spacing was tightened this pass specifically
 * to cut the empty space the Founder flagged as "too boxy" without shrinking
 * either illustration into an icon.
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[9fr_11fr]">
      <LuxuryCard tone="subtle" className="flex flex-col items-center justify-center gap-0.5 px-6 py-6 text-center shadow-luxury-sm transition-shadow duration-150 hover:shadow-luxury-md">
        {display ? (
          <>
            <AnalogClockFace hour24={display.hour24} minute={display.minute} size={CLOCK_FACE_SIZE} />
            <p className="mt-3.5 font-luxury-display text-luxury-card-heading font-semibold text-luxury-text">{location.city}</p>
            <p className="text-luxury-metadata font-medium tracking-[0.1em] text-luxury-text-muted uppercase">{location.region}</p>
            <p className="mt-3 font-luxury-display text-luxury-display leading-none font-semibold text-luxury-text">{display.timeLabel}</p>
            <p className="mt-2 text-luxury-small text-luxury-text-muted">{display.dateLabel}</p>
            <span className="mt-2 flex items-center gap-1 text-luxury-status font-semibold tracking-[0.1em] text-luxury-rose uppercase">
              <DayPeriodGlyph isNight={display.isNight} />
              {display.dayPeriod}
            </span>
          </>
        ) : (
          <div className="h-[19rem] w-full rounded-luxury-md" aria-hidden="true" />
        )}
      </LuxuryCard>

      <LuxuryCard tone="subtle" className="flex flex-col justify-center gap-3 px-6 py-6 shadow-luxury-sm transition-shadow duration-150 hover:shadow-luxury-md">
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
            <div className="flex items-center gap-4">
              <WeatherPin condition={forecast.condition} size={WEATHER_PIN_SIZE} />
              <div className="min-w-0 flex-1">
                <p className="font-luxury-display text-luxury-display leading-none font-semibold text-luxury-text">{forecast.highF}°</p>
                <p className="mt-1 text-luxury-body text-luxury-text-muted">{WEATHER_CONDITION_LABEL[forecast.condition]}</p>
                <p className="mt-2 text-luxury-small font-medium tracking-wide text-luxury-text-muted uppercase">
                  H {forecast.highF}° <span className="mx-1 text-luxury-border">·</span> L {forecast.lowF}°
                </p>
              </div>
            </div>
            {hasMetrics ? (
              <div className="grid grid-cols-2 gap-4 border-t border-luxury-border pt-3">
                {forecast.precipitationProbabilityMax !== null ? (
                  <div className="border-r border-luxury-border pr-4">
                    <p className="text-luxury-metadata font-medium tracking-wide text-luxury-text-muted uppercase">Precip</p>
                    <p className="mt-0.5 font-luxury-display text-luxury-card-heading font-semibold text-luxury-text">{forecast.precipitationProbabilityMax}%</p>
                  </div>
                ) : null}
                {forecast.windSpeedMaxMph !== null ? (
                  <div>
                    <p className="text-luxury-metadata font-medium tracking-wide text-luxury-text-muted uppercase">Wind</p>
                    <p className="mt-0.5 font-luxury-display text-luxury-card-heading font-semibold text-luxury-text">{Math.round(forecast.windSpeedMaxMph)} mph</p>
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
