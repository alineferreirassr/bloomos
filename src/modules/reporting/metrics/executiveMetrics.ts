import { registerReportMetric } from "@/core/reporting/metricRegistry";
import { evaluateObjectivesAction } from "@/modules/objectives/objectivesActions";
import { evaluateExecutiveDecisionsAction } from "@/modules/executiveDecisions/executiveDecisionsActions";
import { evaluateBusinessHealthAction } from "@/modules/knowledgeGraph/businessHealthActions";
import { getExecutiveDashboardData } from "@/modules/analytics/executive/getExecutiveDashboardData";
import type { ReportMetricDefinition, ReportMetricResult } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42 — Executive category. Deliberately surfaces BOTH
 * pre-existing Business Health composites this checkpoint's own Step 0
 * audit found — `core/knowledge/businessHealthEngine.ts`'s
 * `computeBusinessHealth()` (Checkpoint 25, 12 Knowledge Graph categories)
 * and `core/analytics/businessHealthEngine.ts`'s `computeBusinessHealthScore()`
 * (Checkpoint 23, 9 finance/crm/operations dimensions) — rather than
 * merging or picking one. That duplication predates this checkpoint; the
 * Reporting Platform's job is to present facts honestly, not resolve a
 * pre-existing architectural overlap it didn't create. See
 * `docs/reporting-platform.md`'s "Two Business Health systems" section.
 */

function result(value: number | null, unit: ReportMetricResult["unit"]): ReportMetricResult {
  return { value, previousValue: null, unit, series: [], breakdown: [], notApplicableReason: value === null ? "Source action returned no data." : null, stale: false, partial: false };
}

const objectivesOperationalScore: ReportMetricDefinition = {
  id: "executive.objectives_operational_score",
  name: "Objectives Operational Score",
  description: "Overall operational score across every workspace objective.",
  category: "executive",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Operational Objectives Platform (Checkpoint 25.6)",
  sourceEngine: "evaluateObjectivesAction() — scorecard.overallOperationalScore",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["assets.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateObjectivesAction();
    return result(r.success ? r.data.scorecard.overallOperationalScore : null, "percent");
  },
};

const executiveOverallScore: ReportMetricDefinition = {
  id: "executive.overall_score",
  name: "Executive Scorecard",
  description: "Overall executive score composing operations, business health, decisions, readiness, knowledge, and objectives.",
  category: "executive",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Executive Decision Platform (Checkpoint 25.7)",
  sourceEngine: "evaluateExecutiveDecisionsAction() — scorecard.overallExecutiveScore",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["assets.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateExecutiveDecisionsAction();
    return result(r.success ? r.data.scorecard.overallExecutiveScore : null, "percent");
  },
};

const knowledgeGraphBusinessHealth: ReportMetricDefinition = {
  id: "executive.business_health_knowledge_graph",
  name: "Business Health (Knowledge Graph)",
  description: "Business Health composite from the Knowledge Graph / Operational Intelligence domain (relationships, assets, documentation, completeness, workflows, communication, knowledge, dependencies, search).",
  category: "executive",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Operational Intelligence Layer (Checkpoint 25)",
  sourceEngine: "evaluateBusinessHealthAction() — businessHealth.overallScore",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["assets.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["One of two independent Business Health composites in BloomOS — see this file's own doc comment.", "Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await evaluateBusinessHealthAction();
    return result(r.success ? r.data.businessHealth.overallScore : null, "percent");
  },
};

const financeCrmBusinessHealth: ReportMetricDefinition = {
  id: "executive.business_health_finance_crm",
  name: "Business Health (Finance & CRM)",
  description: "Business Health composite from the Executive Analytics domain (finance, CRM, operations, inventory, team, events, payments, risk).",
  category: "executive",
  unit: "percent",
  aggregation: "average",
  sourceModule: "Business Intelligence Platform (Checkpoint 23)",
  sourceEngine: "getExecutiveDashboardData() — businessHealth.score",
  supportedDimensions: [],
  supportedFilters: [],
  freshness: "realtime",
  requiredPermissions: ["analytics.view"],
  featureFlag: null,
  minimumRole: null,
  knownLimitations: ["One of two independent Business Health composites in BloomOS — see this file's own doc comment.", "Current-state snapshot only — no period-over-period comparison."],
  async compute() {
    const r = await getExecutiveDashboardData();
    return result(r.success ? r.data.businessHealth.score : null, "percent");
  },
};

export function registerExecutiveReportMetrics(): void {
  registerReportMetric(objectivesOperationalScore);
  registerReportMetric(executiveOverallScore);
  registerReportMetric(knowledgeGraphBusinessHealth);
  registerReportMetric(financeCrmBusinessHealth);
}
