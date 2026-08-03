import { registerReportMetric } from "@/core/reporting/metricRegistry";
import { evaluateWorkforceAction } from "@/modules/workforce/workforceActions";
import type { ReportMetricDefinition, ReportMetricResult } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42 — Workforce category. Every metric wraps the single
 * real `evaluateWorkforceAction()` (Mobile Workforce Platform, Checkpoint
 * 26) — this file computes nothing itself, it only counts/extracts
 * already-computed fields from `EvaluateWorkforceResult`.
 */

function result(value: number | null, unit: ReportMetricResult["unit"]): ReportMetricResult {
  return { value, previousValue: null, unit, series: [], breakdown: [], notApplicableReason: value === null ? "Source action returned no data." : null, stale: false, partial: false };
}

const workerCount: ReportMetricDefinition = {
  id: "workforce.worker_count",
  name: "Workers",
  description: "Total active workforce members.",
  category: "workforce",
  unit: "count",
  aggregation: "count",
  sourceModule: "Mobile Workforce Platform (Checkpoint 26)",
  sourceEngine: "evaluateWorkforceAction() — workers.length",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["workforce.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateWorkforceAction();
    return result(r.success ? r.data.workers.length : null, "count");
  },
};

const activeAssignmentCount: ReportMetricDefinition = {
  id: "workforce.active_assignment_count",
  name: "Active Assignments",
  description: "Workforce assignments currently in progress.",
  category: "workforce",
  unit: "count",
  aggregation: "count",
  sourceModule: "Mobile Workforce Platform (Checkpoint 26)",
  sourceEngine: "evaluateWorkforceAction() — assignments.filter(status === \"active\").length",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["workforce.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateWorkforceAction();
    return result(r.success ? r.data.assignments.filter((a) => a.status === "active").length : null, "count");
  },
};

const equipmentUtilizationRate: ReportMetricDefinition = {
  id: "workforce.equipment_utilization_rate",
  name: "Equipment Utilization",
  description: "Share of registered equipment currently in use.",
  category: "workforce",
  unit: "percent",
  aggregation: "rate",
  sourceModule: "Mobile Workforce Platform (Checkpoint 26)",
  sourceEngine: "evaluateWorkforceAction() — equipmentUtilization",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["workforce.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison.", "notApplicable when the workspace has no registered equipment yet."],
  async compute() {
    const r = await evaluateWorkforceAction();
    if (!r.success) return result(null, "percent");
    const { totalCount, inUseCount } = r.data.equipmentUtilization;
    if (totalCount === 0) return { value: null, previousValue: null, unit: "percent", series: [], breakdown: [], notApplicableReason: "No registered equipment yet.", stale: false, partial: false };
    return result((inUseCount / totalCount) * 100, "percent");
  },
};

const teamCount: ReportMetricDefinition = {
  id: "workforce.team_count",
  name: "Teams",
  description: "Total active workforce teams/crews.",
  category: "workforce",
  unit: "count",
  aggregation: "count",
  sourceModule: "Mobile Workforce Platform (Checkpoint 26)",
  sourceEngine: "evaluateWorkforceAction() — teams.length",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["workforce.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateWorkforceAction();
    return result(r.success ? r.data.teams.length : null, "count");
  },
};

export function registerWorkforceReportMetrics(): void {
  registerReportMetric(workerCount);
  registerReportMetric(teamCount);
  registerReportMetric(activeAssignmentCount);
  registerReportMetric(equipmentUtilizationRate);
}
