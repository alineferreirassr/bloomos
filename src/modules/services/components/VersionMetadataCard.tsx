import { Card } from "@/components/ui/Card";
import { SERVICE_EXPERIENCE_LEVEL_LABELS } from "@/core/enums/serviceExperienceLevel";
import { SERVICE_WEATHER_SENSITIVITY_LABELS } from "@/core/enums/serviceWeatherSensitivity";
import type { ServiceVersion } from "@/types/serviceVersion";

interface VersionMetadataCardProps {
  version: ServiceVersion;
}

/** Every field here is read directly off the selected `ServiceVersion` row — never recomputed, never merged with the current draft's values, so an old published version's metadata is shown exactly as it was frozen at publish time. */
export function VersionMetadataCard({ version }: VersionMetadataCardProps) {
  const rows: Array<[string, string]> = [
    ["Setup time", version.setup_duration_minutes != null ? `${version.setup_duration_minutes} min` : "—"],
    ["Breakdown time", version.breakdown_duration_minutes != null ? `${version.breakdown_duration_minutes} min` : "—"],
    ["Difficulty", version.difficulty_score != null ? `${version.difficulty_score} / 5` : "—"],
    ["Experience required", version.experience_level_required ? SERVICE_EXPERIENCE_LEVEL_LABELS[version.experience_level_required] : "—"],
    ["Weather sensitivity", SERVICE_WEATHER_SENSITIVITY_LABELS[version.weather_sensitivity]],
    ["Surprise-friendly", version.surprise_friendly ? "Yes" : "No"],
    ["Estimated profit", version.estimated_profit_minor != null ? `$${(version.estimated_profit_minor / 100).toFixed(0)}` : "—"],
  ];

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Version metadata</h3>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="text-text">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
