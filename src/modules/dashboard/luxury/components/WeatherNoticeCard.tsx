import { ImportantNotesCard } from "@/modules/dashboard/luxury/components/ImportantNotesCard";

export interface WeatherNoticeData {
  description: string;
  highLabel: string;
  lowLabel: string;
}

/** Checkpoint 19, Step 6 — a thin `ImportantNotesCard` wrapper for the weather notice specifically, reusing an Event's real `weather_plan` field (`src/types/event.ts`) rather than a fabricated forecast; high/low are only ever rendered when supplied by the caller (no weather API integration — out of scope). */
export function WeatherNoticeCard({ weather }: { weather: WeatherNoticeData }) {
  return (
    <ImportantNotesCard note={{ id: "weather", icon: "Weather", title: "Weather update", description: weather.description }}>
      <p className="mt-1.5 text-luxury-small text-luxury-text-muted">
        High: {weather.highLabel} &nbsp;•&nbsp; Low: {weather.lowLabel}
      </p>
    </ImportantNotesCard>
  );
}
