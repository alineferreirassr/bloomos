import { getDashboardMetrics } from "@/lib/data/mock/dashboardMetrics";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";

export default function DashboardPage() {
  const metrics = getDashboardMetrics();

  return (
    <div>
      <h2 className="text-xl font-semibold text-text">Dashboard</h2>
      <p className="mt-1 text-sm text-text-muted">
        Operational overview for Amoré Bloom. Metrics below go live as each
        module ships.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>
    </div>
  );
}
