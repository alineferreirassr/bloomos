import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { EventHealthDetails } from "@/core/workflows/eventHealth";

function severityTone(score: number): BadgeTone {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function severityLabel(score: number): string {
  if (score >= 80) return "Healthy";
  if (score >= 50) return "Needs attention";
  return "At risk";
}

/** Renders getEventHealthDetails()'s output only — no scoring logic here. */
export function EventHealthCard({ health }: { health: EventHealthDetails }) {
  const topRisks = health.factors.slice(0, 3);

  return (
    <LuxuryCard>
      <h3 className="font-serif text-[17px] font-semibold text-text">Event Health</h3>
      <div className="mt-3 flex items-center gap-3">
        <span className="font-serif text-[32px] leading-tight font-semibold tabular-nums text-text">
          {health.score}
        </span>
        <Badge tone={severityTone(health.score)}>{severityLabel(health.score)}</Badge>
      </div>
      <p className="mt-2 text-xs text-text-muted">
        {health.factors.length === 0
          ? "No risks detected — this event is in good shape."
          : `${health.factors.length} risk factor${health.factors.length === 1 ? "" : "s"} affecting this score.`}
      </p>
      {topRisks.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {topRisks.map((factor) => (
            <li key={factor.label} className="flex items-center justify-between text-xs text-text">
              <span>{factor.label}</span>
              <span className="text-text-muted">−{factor.deduction}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </LuxuryCard>
  );
}
