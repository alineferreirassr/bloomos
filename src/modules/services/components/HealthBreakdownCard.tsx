import { Card } from "@/components/ui/Card";

interface HealthBreakdownCardProps {
  blockingCount: number;
  warningCount: number;
  completeCount: number;
  totalCount: number;
}

export function HealthBreakdownCard({ blockingCount, warningCount, completeCount, totalCount }: HealthBreakdownCardProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Breakdown</h3>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-xs text-text-muted">Blocking</dt>
          <dd className="mt-0.5 text-lg font-semibold text-danger">{blockingCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Warnings</dt>
          <dd className="mt-0.5 text-lg font-semibold text-text">{warningCount}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Complete</dt>
          <dd className="mt-0.5 text-lg font-semibold text-text">
            {completeCount} / {totalCount}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
