import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { WorkspaceHealthSummary } from "@/types/smartWorkspace";

const BAND_TONE: Record<string, BadgeTone> = { excellent: "success", good: "success", attention: "warning", critical: "danger" };

/** v2.0 Checkpoint 38, Step 12 — a single number, `evaluateOperationsCenterAction()`'s own `overallOperationsCenterHealth`, which already composes Dispatch/Field Operations/Route Optimization/Scheduling/Resource Allocation/Execution Packages/Workforce/Business Health/Knowledge/Objectives. This widget never re-derives any of that. */
export function OperationalOverviewWidget({ health }: { health: WorkspaceHealthSummary }) {
  const operational = health.platforms.find((p) => p.key === "operational");
  if (!operational) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-semibold text-text">{operational.score}</span>
        <Badge tone={BAND_TONE[operational.band]}>{operational.band}</Badge>
      </div>
      <p className="text-xs text-text-muted">One composite of Dispatch, Field Operations, Route Optimization, Scheduling, Resource Allocation, Execution Packages, Workforce, Business Health, Knowledge, and Objectives.</p>
      <Link href="/operations-center" className="text-xs font-medium text-accent hover:underline">
        Open Operations Center →
      </Link>
    </div>
  );
}
