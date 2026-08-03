import { registerReportMetric } from "@/core/reporting/metricRegistry";
import { evaluateDispatchPlatformHealthAction } from "@/modules/dispatch/dispatchActions";
import { evaluateFieldOperationsPlatformHealthAction } from "@/modules/fieldOperations/fieldOperationsActions";
import { evaluateRouteOptimizationPlatformHealthAction } from "@/modules/routeOptimization/routeOptimizationActions";
import { evaluateOperationsCenterAction } from "@/modules/operationsCenter/operationsCenterActions";
import type { ReportMetricDefinition, ReportMetricResult } from "@/types/reportMetric";

/**
 * Checkpoint 45A — Finding 18. Operations category. Closes the gap
 * `docs/v1.0-known-limitations.md` disclosed: Dispatch, Field Operations,
 * Route Optimization, and Operations Center had no Reporting Metric
 * Registry entries. Every metric here wraps one of those platforms' own
 * already-computed `evaluate*Action()` result — no new computation.
 */

function result(value: number | null, unit: ReportMetricResult["unit"]): ReportMetricResult {
  return { value, previousValue: null, unit, series: [], breakdown: [], notApplicableReason: value === null ? "Source action returned no data." : null, stale: false, partial: false };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

const dispatchOrderCount: ReportMetricDefinition = {
  id: "operations.dispatch_order_count",
  name: "Dispatch Orders",
  description: "Total dispatch orders currently tracked.",
  category: "operations",
  unit: "count",
  aggregation: "count",
  sourceModule: "Dispatch Platform (Checkpoint 28)",
  sourceEngine: "evaluateDispatchPlatformHealthAction() — results.length",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["dispatch.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateDispatchPlatformHealthAction();
    return result(r.success ? r.data.results.length : null, "count");
  },
};

const dispatchHealthScore: ReportMetricDefinition = {
  id: "operations.dispatch_health_score",
  name: "Dispatch Health",
  description: "Average dispatch health score across all tracked orders.",
  category: "operations",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Dispatch Platform (Checkpoint 28)",
  sourceEngine: "evaluateDispatchPlatformHealthAction() — results[].health.overallDispatchHealth",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["dispatch.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison.", "notApplicable when no dispatch orders exist yet."],
  async compute() {
    const r = await evaluateDispatchPlatformHealthAction();
    if (!r.success) return result(null, "percent");
    return result(average(r.data.results.map((o) => o.health.overallDispatchHealth)), "percent");
  },
};

const fieldOperationCount: ReportMetricDefinition = {
  id: "operations.field_operation_count",
  name: "Field Operations",
  description: "Total field operation execution sessions currently tracked.",
  category: "operations",
  unit: "count",
  aggregation: "count",
  sourceModule: "Field Operations Platform (Checkpoint 29)",
  sourceEngine: "evaluateFieldOperationsPlatformHealthAction() — results.length",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["field_operations.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateFieldOperationsPlatformHealthAction();
    return result(r.success ? r.data.results.length : null, "count");
  },
};

const fieldOperationHealthScore: ReportMetricDefinition = {
  id: "operations.field_operation_health_score",
  name: "Field Operations Health",
  description: "Average execution health score across all tracked field operations.",
  category: "operations",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Field Operations Platform (Checkpoint 29)",
  sourceEngine: "evaluateFieldOperationsPlatformHealthAction() — results[].health.overallOperationalHealth",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["field_operations.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison.", "notApplicable when no field operations exist yet."],
  async compute() {
    const r = await evaluateFieldOperationsPlatformHealthAction();
    if (!r.success) return result(null, "percent");
    return result(average(r.data.results.map((e) => e.health.overallOperationalHealth)), "percent");
  },
};

const routePlanCount: ReportMetricDefinition = {
  id: "operations.route_plan_count",
  name: "Route Plans",
  description: "Total route plans currently tracked.",
  category: "operations",
  unit: "count",
  aggregation: "count",
  sourceModule: "Route Optimization Platform (Checkpoint 30)",
  sourceEngine: "evaluateRouteOptimizationPlatformHealthAction() — results.length",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["route_optimization.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateRouteOptimizationPlatformHealthAction();
    return result(r.success ? r.data.results.length : null, "count");
  },
};

const routeHealthScore: ReportMetricDefinition = {
  id: "operations.route_health_score",
  name: "Route Health",
  description: "Average route health score across all tracked route plans.",
  category: "operations",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Route Optimization Platform (Checkpoint 30)",
  sourceEngine: "evaluateRouteOptimizationPlatformHealthAction() — results[].health.overallRouteHealth",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["route_optimization.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison.", "notApplicable when no route plans exist yet."],
  async compute() {
    const r = await evaluateRouteOptimizationPlatformHealthAction();
    if (!r.success) return result(null, "percent");
    return result(average(r.data.results.map((route) => route.health.overallRouteHealth)), "percent");
  },
};

const activeOperationsCount: ReportMetricDefinition = {
  id: "operations.active_operations_count",
  name: "Active Operations",
  description: "Operations currently active across every operational platform.",
  category: "operations",
  unit: "count",
  aggregation: "count",
  sourceModule: "Operations Center (Checkpoint 31)",
  sourceEngine: "evaluateOperationsCenterAction() — kpis.activeOperations",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["operations_center.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateOperationsCenterAction();
    return result(r.success ? r.data.kpis.activeOperations : null, "count");
  },
};

const operationsCenterHealthScore: ReportMetricDefinition = {
  id: "operations.operations_center_health_score",
  name: "Operations Center Health",
  description: "Composite health score across every operational platform Operations Center aggregates.",
  category: "operations",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Operations Center (Checkpoint 31)",
  sourceEngine: "evaluateOperationsCenterAction() — health.overallOperationsCenterHealth",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["operations_center.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateOperationsCenterAction();
    return result(r.success ? r.data.health.overallOperationsCenterHealth : null, "percent");
  },
};

export function registerOperationsReportMetrics(): void {
  registerReportMetric(dispatchOrderCount);
  registerReportMetric(dispatchHealthScore);
  registerReportMetric(fieldOperationCount);
  registerReportMetric(fieldOperationHealthScore);
  registerReportMetric(routePlanCount);
  registerReportMetric(routeHealthScore);
  registerReportMetric(activeOperationsCount);
  registerReportMetric(operationsCenterHealthScore);
}
