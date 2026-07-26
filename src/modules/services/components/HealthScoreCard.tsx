import { Card } from "@/components/ui/Card";
import { HealthGauge } from "@/modules/services/components/HealthGauge";

interface HealthScoreCardProps {
  percent: number;
}

export function HealthScoreCard({ percent }: HealthScoreCardProps) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-text">Overall Health</h2>
        <span className="text-2xl font-semibold text-text">{percent}%</span>
      </div>
      <div className="mt-4">
        <HealthGauge percent={percent} variant="full" label="Overall health score" />
      </div>
    </Card>
  );
}
