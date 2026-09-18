import Link from "next/link";
import { Droplets, Wind } from "lucide-react";
import { WeatherPin } from "@/components/ui/WeatherPin";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { operationalNote } from "@/modules/dashboard/luxury/components/NextEventWeatherCard";
import { WEATHER_CONDITION_LABEL, type DailyForecast } from "@/types/weather";
import type { NextEventWeather } from "@/modules/dashboard/luxury/getOwnerDashboardData";

const WEATHER_PIN_SIZE = 132;

interface OwnerWeatherCardProps {
  data: NextEventWeather | null;
  contingencyNote?: string | null;
  fallback?: { locationLabel: string; forecast: DailyForecast } | null;
}

function MetricPair({ precipitationProbability, windSpeedMph }: { precipitationProbability: number | null; windSpeedMph: number | null }) {
  if (precipitationProbability === null && windSpeedMph === null) return null;
  return (
    <div className="mt-5 grid grid-cols-2 gap-4 border-t border-luxury-border pt-5">
      {precipitationProbability !== null ? (
        <div className="flex items-center gap-2">
          <Droplets className="size-4 shrink-0 text-luxury-rose" aria-hidden="true" />
          <div>
            <p className="text-luxury-status tracking-wide text-luxury-text-muted uppercase">Precip</p>
            <p className="font-medium tabular-nums text-luxury-text">{precipitationProbability}%</p>
          </div>
        </div>
      ) : null}
      {windSpeedMph !== null ? (
        <div className="flex items-center gap-2">
          <Wind className="size-4 shrink-0 text-luxury-rose" aria-hidden="true" />
          <div>
            <p className="text-luxury-status tracking-wide text-luxury-text-muted uppercase">Wind</p>
            <p className="font-medium tabular-nums text-luxury-text">{Math.round(windSpeedMph)} mph</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * VISUAL-01 Revision C — the Owner Home's own refined, AF-inspired Weather
 * module. `NextEventWeatherCard` (still used unchanged by Team, see its
 * own doc comment) is a compact narrow-card layout; the founder rejected
 * that composition specifically for Home ("narrow coarse utility card") in
 * favor of a wider, more spacious module — same "Owner-only variant of a
 * shared concept" precedent as `OwnerHomeHeader` vs.
 * `PersonalizedWelcomeHeader` and `StudioTodayCard` vs. `LuxuryMetricCard`.
 * Reuses the exact same real data (`NextEventWeather`/`DailyForecast`) and
 * the exact same `operationalNote()` logic (exported from
 * `NextEventWeatherCard.tsx`, not duplicated) — no field beyond
 * temperature/condition/high-low/precipitation/wind/location/recommendation
 * is rendered, since BloomOS's weather data has nothing else truthful to
 * show (no humidity/UV/feels-like/updated-time exist anywhere in
 * `src/types/weather.ts`).
 */
export function OwnerWeatherCard({ data, contingencyNote, fallback }: OwnerWeatherCardProps) {
  if (!data) {
    if (fallback) {
      const { forecast } = fallback;
      const precipitationProbability = forecast.precipitationProbabilityMax;
      const windSpeedMph = forecast.windSpeedMaxMph;
      const note = operationalNote(forecast.condition, precipitationProbability);
      return (
        <LuxuryCard tone="surface" className="flex h-full flex-col gap-1 p-7">
          <div className="flex items-baseline justify-between">
            <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-text-muted uppercase">♡ Weather</p>
            <span className="text-luxury-small font-medium text-luxury-rose">{fallback.locationLabel}</span>
          </div>
          <div className="mt-4 flex items-center gap-6">
            <WeatherPin condition={forecast.condition} size={WEATHER_PIN_SIZE} />
            <div className="min-w-0">
              <p className="font-luxury-display text-[3.25rem] leading-none font-semibold text-luxury-text">{forecast.highF}°</p>
              <p className="mt-2 text-luxury-body text-luxury-text-muted">{WEATHER_CONDITION_LABEL[forecast.condition]}</p>
              <p className="mt-1 text-luxury-small font-medium tabular-nums text-luxury-text-muted">
                H {forecast.highF}° &middot; L {forecast.lowF}°
              </p>
            </div>
          </div>
          <MetricPair precipitationProbability={precipitationProbability} windSpeedMph={windSpeedMph} />
          {note ? <p className="mt-4 text-luxury-small text-luxury-text-muted">{note}</p> : null}
          {contingencyNote ? (
            <p className="mt-4 border-t border-luxury-border pt-4 text-luxury-small text-luxury-text-muted">
              <span className="font-medium text-luxury-text">Contingency plan:</span> {contingencyNote}
            </p>
          ) : null}
        </LuxuryCard>
      );
    }
    return (
      <LuxuryCard tone="surface" className="flex h-full flex-col justify-center gap-1 p-7">
        <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-text-muted uppercase">♡ Weather</p>
        <p className="mt-2 text-luxury-body text-luxury-text-muted">No upcoming event with a set location yet — weather appears here once one is scheduled.</p>
      </LuxuryCard>
    );
  }

  const { forecast } = data;
  const snapshot = forecast.eventTime;
  const day = forecast.day;

  if (!snapshot && !day) {
    return (
      <LuxuryCard tone="surface" className="flex h-full flex-col justify-center gap-1 p-7">
        <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-text-muted uppercase">♡ Weather</p>
        <p className="mt-2 text-luxury-body text-luxury-text-muted">Weather unavailable for {data.title}.</p>
      </LuxuryCard>
    );
  }

  const condition = snapshot?.condition ?? day!.condition;
  const temperatureLabel = snapshot ? `${snapshot.temperatureF}°` : `${day!.highF}°`;
  const precipitationProbability = day?.precipitationProbabilityMax ?? snapshot?.precipitationProbability ?? null;
  const windSpeedMph = snapshot?.windSpeedMph ?? day?.windSpeedMaxMph ?? null;
  const note = operationalNote(condition, precipitationProbability);

  return (
    <LuxuryCard tone="surface" className="flex h-full flex-col gap-1 p-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-luxury-metadata font-semibold tracking-wide text-luxury-text-muted uppercase">♡ Weather</p>
        <Link href={`/events/${data.eventId}`} className="max-w-[10rem] truncate text-luxury-small font-medium text-luxury-rose">
          {data.title}
        </Link>
      </div>
      <p className="text-luxury-small text-luxury-text-muted">
        {data.dateLabel}
        {snapshot && data.timeLabel ? ` · ${data.timeLabel}` : ""}
      </p>
      <div className="mt-4 flex items-center gap-6">
        <WeatherPin condition={condition} size={WEATHER_PIN_SIZE} />
        <div className="min-w-0">
          <p className="font-luxury-display text-[3.25rem] leading-none font-semibold text-luxury-text">{temperatureLabel}</p>
          <p className="mt-2 text-luxury-body text-luxury-text-muted">{WEATHER_CONDITION_LABEL[condition]}</p>
          {day ? (
            <p className="mt-1 text-luxury-small font-medium tabular-nums text-luxury-text-muted">
              H {day.highF}° &middot; L {day.lowF}°
            </p>
          ) : null}
        </div>
      </div>
      <MetricPair precipitationProbability={precipitationProbability} windSpeedMph={windSpeedMph} />
      {note ? <p className="mt-4 text-luxury-small text-luxury-text-muted">{note}</p> : null}
      {contingencyNote ? (
        <p className="mt-4 border-t border-luxury-border pt-4 text-luxury-small text-luxury-text-muted">
          <span className="font-medium text-luxury-text">Contingency plan:</span> {contingencyNote}
        </p>
      ) : null}
    </LuxuryCard>
  );
}
