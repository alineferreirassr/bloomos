import Link from "next/link";
import { WeatherPin } from "@/components/ui/WeatherPin";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { WEATHER_CONDITION_LABEL, type WeatherCondition } from "@/types/weather";
import type { NextEventWeather } from "@/modules/dashboard/luxury/getOwnerDashboardData";

const RAIN_CONDITIONS: readonly WeatherCondition[] = ["RAIN", "LIGHT_RAIN_DRIZZLE", "THUNDERSTORM"];
const CLEAR_CONDITIONS: readonly WeatherCondition[] = ["SUNNY", "PARTLY_CLOUDY", "NIGHT_CLEAR"];

/** A one-line operational read of the forecast, derived only from the condition/precipitation values already on the snapshot — never a fixed per-condition string bank that could drift from what a given day's numbers actually show, and never rendered when neither signal gives a confident read (e.g. plain CLOUDY with no precipitation data). */
function operationalNote(condition: WeatherCondition, precipitationProbability: number | null): string | null {
  if (RAIN_CONDITIONS.includes(condition) || (precipitationProbability !== null && precipitationProbability >= 50)) {
    return "Rain possible — review outdoor setups.";
  }
  if (condition === "SNOW") return "Snow expected — plan for travel delays.";
  if (condition === "FOG_MIST") return "Reduced visibility — allow extra travel time.";
  if (CLEAR_CONDITIONS.includes(condition)) return "Clear conditions for outdoor setups.";
  return null;
}

interface NextEventWeatherCardProps {
  data: NextEventWeather | null;
  /**
   * The Team Dashboard's founder-authored `weather_plan` free-text note for
   * the event — deliberately kept separate from the live forecast above it
   * rather than merged into one string, since they're genuinely different
   * data (a real-time forecast vs. a manually-written contingency plan).
   * Owner's dashboard never passes this — there is no equivalent concept
   * on the Founder side.
   */
  contingencyNote?: string | null;
}

/**
 * The shared "next event weather" card — originally Owner-only
 * (`OwnerNextEventWeatherCard`), generalized so Team's dashboard reuses the
 * exact same component/visual system instead of its own parallel
 * `TeamEventWeatherCard` implementation (the Founder's explicit "do not
 * create duplicate independent implementations" instruction). "Next Event
 * Weather" rather than "Next Outdoor Event", per the founder's own
 * preference combined with the honest limitation that `Event` has no
 * indoor/outdoor field to filter on (see `getOwnerDashboardData.ts`'s
 * `NextEventWeather` doc comment). Self-owns its `LuxuryCard`/
 * `SectionHeader` shell so it can render a graceful empty/unavailable state
 * instead of vanishing from the layout entirely — a `null` `data` (no
 * eligible event) or a resolved-but-dataless forecast both still render a
 * named message, never nothing.
 */
export function NextEventWeatherCard({ data, contingencyNote }: NextEventWeatherCardProps) {
  if (!data) {
    return (
      <LuxuryCard>
        <SectionHeader title="Weather" />
        <p className="mt-1 text-luxury-small text-luxury-text-muted">No upcoming event with a set location yet — weather appears here once one is scheduled.</p>
        {contingencyNote ? (
          <p className="mt-3 border-t border-luxury-border pt-3 text-luxury-small text-luxury-text-muted">
            <span className="font-medium text-luxury-text">Contingency plan:</span> {contingencyNote}
          </p>
        ) : null}
      </LuxuryCard>
    );
  }

  const { forecast } = data;
  const snapshot = forecast.eventTime;
  const day = forecast.day;

  if (!snapshot && !day) {
    return (
      <LuxuryCard>
        <SectionHeader title="Weather" />
        <p className="mt-1 text-luxury-small text-luxury-text-muted">Weather unavailable for {data.title}.</p>
        {contingencyNote ? (
          <p className="mt-3 border-t border-luxury-border pt-3 text-luxury-small text-luxury-text-muted">
            <span className="font-medium text-luxury-text">Contingency plan:</span> {contingencyNote}
          </p>
        ) : null}
      </LuxuryCard>
    );
  }

  const condition = snapshot?.condition ?? day!.condition;
  const temperatureLabel = snapshot ? `${snapshot.temperatureF}°` : `${day!.highF}°`;
  const precipitationProbability = day?.precipitationProbabilityMax ?? snapshot?.precipitationProbability ?? null;
  const windSpeedMph = snapshot?.windSpeedMph ?? day?.windSpeedMaxMph ?? null;
  const note = operationalNote(condition, precipitationProbability);
  const hasMetricsRow = precipitationProbability !== null || windSpeedMph !== null;

  return (
    <LuxuryCard>
      <SectionHeader
        title="Weather"
        action={
          <Link href={`/events/${data.eventId}`} className="max-w-[9rem] truncate text-luxury-small font-medium text-luxury-rose">
            {data.title}
          </Link>
        }
      />
      <p className="text-luxury-small text-luxury-text-muted">
        {data.dateLabel}
        {snapshot && data.timeLabel ? ` · ${data.timeLabel}` : ""}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <WeatherPin condition={condition} size={56} />
        <div className="min-w-0">
          <p className="font-luxury-display text-luxury-display leading-none font-semibold text-luxury-text">{temperatureLabel}</p>
          <p className="mt-1 text-luxury-small text-luxury-text-muted">{WEATHER_CONDITION_LABEL[condition]}</p>
        </div>
        {day ? (
          <p className="ml-auto shrink-0 text-luxury-small text-luxury-text-muted">
            H {day.highF}° · L {day.lowF}°
          </p>
        ) : null}
      </div>
      {hasMetricsRow ? (
        <div className="mt-3 flex gap-5 border-t border-luxury-border pt-3">
          {precipitationProbability !== null ? (
            <div>
              <p className="text-luxury-metadata text-luxury-text-muted">Precip</p>
              <p className="text-luxury-small font-medium text-luxury-text">{precipitationProbability}%</p>
            </div>
          ) : null}
          {windSpeedMph !== null ? (
            <div>
              <p className="text-luxury-metadata text-luxury-text-muted">Wind</p>
              <p className="text-luxury-small font-medium text-luxury-text">{Math.round(windSpeedMph)} mph</p>
            </div>
          ) : null}
        </div>
      ) : null}
      {note ? <p className="mt-2 text-luxury-small text-luxury-text-muted">{note}</p> : null}
      {contingencyNote ? (
        <p className="mt-2 border-t border-luxury-border pt-2 text-luxury-small text-luxury-text-muted">
          <span className="font-medium text-luxury-text">Contingency plan:</span> {contingencyNote}
        </p>
      ) : null}
    </LuxuryCard>
  );
}
