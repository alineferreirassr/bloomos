import { DashboardMetrics } from "@/modules/dashboard/components/DashboardMetrics";
import { WorkspaceSessionPanel } from "@/modules/dashboard/components/WorkspaceSessionPanel";

export default function DashboardPage() {
  return (
    <div>
      <h2 className="text-3xl font-semibold text-text">Dashboard</h2>
      <p className="mt-1 text-sm text-text-muted">
        Operational overview for Amoré Bloom. Metrics below go live as each
        module ships.
      </p>
      <div className="mt-6">
        <WorkspaceSessionPanel />
        <DashboardMetrics />
      </div>
    </div>
  );
}
