import { Card } from "@/components/ui/Card";
import { HealthGauge } from "@/modules/services/components/HealthGauge";
import { HealthMissingList } from "@/modules/services/components/HealthMissingList";
import type { ServiceHealthMissingItem, ServiceHealthSummary } from "@/lib/queries/services/types";

interface ServiceHealthSummaryCardProps {
  health: ServiceHealthSummary;
  /** Callback contract for navigation — this card never knows or decides where a missing item leads; the caller (a real screen, in a later checkpoint) owns that. */
  onMissingItemSelect?: (item: ServiceHealthMissingItem) => void;
  maxMissingItems?: number;
  className?: string;
}

/** Purely presentational — consumes an already-computed `ServiceHealthSummary` from the query layer and never recomputes health itself. */
export function ServiceHealthSummaryCard({ health, onMissingItemSelect, maxMissingItems = 5, className = "" }: ServiceHealthSummaryCardProps) {
  const missing = health.missing.slice(0, maxMissingItems);

  return (
    <Card className={className}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-[17px] font-semibold text-text">Service Health</h3>
        <span className="text-sm font-semibold text-text">{health.percent}%</span>
      </div>
      <div className="mt-3">
        <HealthGauge percent={health.percent} variant="compact" />
      </div>
      {missing.length > 0 ? (
        <div className="mt-4">
          <HealthMissingList items={missing} onSelect={onMissingItemSelect} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-text-muted">Nothing missing — this Service is fully set up.</p>
      )}
    </Card>
  );
}
