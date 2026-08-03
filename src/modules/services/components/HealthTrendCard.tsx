import { Card } from "@/components/ui/Card";

interface HealthTrendCardProps {
  percent: number;
}

/** Current snapshot only — historical comparison needs a data source (a stored series of past scores) that doesn't exist yet; this deliberately doesn't fabricate one. */
export function HealthTrendCard({ percent }: HealthTrendCardProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Trend</h3>
      <p className="mt-2 text-sm text-text">
        Current snapshot: <strong>{percent}%</strong>
      </p>
      <p className="mt-1 text-xs text-text-muted">Historical comparison isn&apos;t available yet — this reflects the Service&apos;s health right now.</p>
    </Card>
  );
}
