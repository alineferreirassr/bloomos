import { REPORT_CATEGORIES } from "@/types/reporting";
import type { ReportSnapshot, ReportSourceDiagnostic, ReportTemplate, SavedReport } from "@/types/reporting";
import type { ReportMetricDefinition } from "@/types/reportMetric";
import type { ReportingFinding, ReportingHealthCategoryScore, ReportingHealthReport } from "@/types/reportingHealth";

/**
 * v2.0 Checkpoint 42, Step 9 — Reporting Health Engine. Same category-score
 * composite pattern every domain-level Health Engine in this codebase
 * already uses (`core/notifications/notificationHealthEngine.ts`,
 * `core/search/searchHealthEngine.ts`) — every score here is computed from
 * data the caller already fetched (the registry, the workspace's own
 * reports/snapshots, and real measured computation durations); this engine
 * detects nothing on its own and never calls a repository or re-scores
 * anything Business Health/Operational Intelligence already scores (see
 * `docs/reporting-health.md` for how this composes into those, rather than
 * duplicating them).
 */

const RELEVANT_CATEGORIES = REPORT_CATEGORIES.filter((c) => c !== "custom");
const MIN_SCORE = 0;
const MAX_SCORE = 100;

function clampScore(score: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(score)));
}

function computeMetricCoverageCategory(allMetrics: ReportMetricDefinition[]): ReportingHealthCategoryScore {
  const covered = new Set(allMetrics.map((m) => m.category));
  const missing = RELEVANT_CATEGORIES.filter((c) => !covered.has(c));
  const score = clampScore(((RELEVANT_CATEGORIES.length - missing.length) / RELEVANT_CATEGORIES.length) * 100);
  return {
    category: "metric_coverage",
    score,
    issues: missing.length > 0 ? [`${missing.length} of ${RELEVANT_CATEGORIES.length} report categories have no registered metric: ${missing.join(", ")}.`] : [],
    notApplicableReason: null,
  };
}

function computeSourceAvailabilityCategory(latestDiagnostics: ReportSourceDiagnostic[]): ReportingHealthCategoryScore {
  if (latestDiagnostics.length === 0) return { category: "source_availability", score: null, issues: [], notApplicableReason: "No report snapshots have been generated yet." };
  const unavailable = latestDiagnostics.filter((d) => d.status === "unavailable");
  const score = clampScore(100 - (unavailable.length / latestDiagnostics.length) * 100);
  return {
    category: "source_availability",
    score,
    issues: unavailable.length > 0 ? [`${unavailable.length} of ${latestDiagnostics.length} metric source(s) in the most recent snapshots are unavailable.`] : [],
    notApplicableReason: null,
  };
}

function computeSourceFreshnessCategory(latestDiagnostics: ReportSourceDiagnostic[]): ReportingHealthCategoryScore {
  if (latestDiagnostics.length === 0) return { category: "source_freshness", score: null, issues: [], notApplicableReason: "No report snapshots have been generated yet." };
  const stale = latestDiagnostics.filter((d) => d.status === "stale");
  const score = clampScore(100 - (stale.length / latestDiagnostics.length) * 100);
  return {
    category: "source_freshness",
    score,
    issues: stale.length > 0 ? [`${stale.length} of ${latestDiagnostics.length} metric source(s) in the most recent snapshots may be stale.`] : [],
    notApplicableReason: null,
  };
}

/** Specifically checks that `finance`/`executive` metrics — the two categories a Client-Safe or under-permissioned view must never leak — declare a required permission beyond the baseline `reports.view` gate every metric already passes through. */
function computePermissionConfigurationCategory(allMetrics: ReportMetricDefinition[]): ReportingHealthCategoryScore {
  const sensitive = allMetrics.filter((m) => m.category === "finance" || m.category === "executive");
  if (sensitive.length === 0) return { category: "permission_configuration", score: null, issues: [], notApplicableReason: "No finance or executive metrics registered yet." };
  const ungated = sensitive.filter((m) => m.requiredPermissions.length === 0);
  const score = clampScore(100 - (ungated.length / sensitive.length) * 100);
  return {
    category: "permission_configuration",
    score,
    issues: ungated.length > 0 ? [`${ungated.length} finance/executive metric(s) declare no required permission beyond reports.view: ${ungated.map((m) => m.id).join(", ")}.`] : [],
    notApplicableReason: null,
  };
}

function computeTemplateCoverageCategory(templates: ReportTemplate[]): ReportingHealthCategoryScore {
  const covered = new Set(templates.filter((t) => t.builtIn && t.category !== "custom").map((t) => t.category));
  const missing = RELEVANT_CATEGORIES.filter((c) => !covered.has(c));
  const score = clampScore(((RELEVANT_CATEGORIES.length - missing.length) / RELEVANT_CATEGORIES.length) * 100);
  return {
    category: "template_coverage",
    score,
    issues: missing.length > 0 ? [`${missing.length} of ${RELEVANT_CATEGORIES.length} report categories have no built-in template: ${missing.join(", ")}.`] : [],
    notApplicableReason: null,
  };
}

function computeSnapshotIntegrityCategory(reports: SavedReport[], snapshots: ReportSnapshot[]): ReportingHealthCategoryScore {
  if (snapshots.length === 0) return { category: "snapshot_integrity", score: null, issues: [], notApplicableReason: "No report snapshots have been generated yet." };
  const reportIds = new Set(reports.map((r) => r.id));
  const orphaned = snapshots.filter((s) => !reportIds.has(s.report_id));
  const score = clampScore(100 - (orphaned.length / snapshots.length) * 100);
  return {
    category: "snapshot_integrity",
    score,
    issues: orphaned.length > 0 ? [`${orphaned.length} snapshot(s) reference a report that no longer exists.`] : [],
    notApplicableReason: null,
  };
}

/** Scored from real measured `computeReport()` durations (`core/reporting/computationEngine.ts`'s own `totalDurationMs`), never a fabricated benchmark. */
function computePerformanceCategory(recentDurationsMs: number[]): ReportingHealthCategoryScore {
  if (recentDurationsMs.length === 0) return { category: "performance", score: null, issues: [], notApplicableReason: "No report computations have been timed yet." };
  const average = recentDurationsMs.reduce((sum, d) => sum + d, 0) / recentDurationsMs.length;
  const score = average <= 300 ? 100 : average <= 800 ? 80 : average <= 2000 ? 55 : average <= 5000 ? 30 : 10;
  return {
    category: "performance",
    score,
    issues: score < 80 ? [`Average report computation time is ${Math.round(average)}ms across the last ${recentDurationsMs.length} run(s).`] : [],
    notApplicableReason: null,
  };
}

function findingsFromCategories(categories: ReportingHealthCategoryScore[]): ReportingFinding[] {
  const findings: ReportingFinding[] = [];
  for (const category of categories) {
    for (const issue of category.issues) {
      const severity = category.score === null ? "info" : category.score < 50 ? "critical" : category.score < 80 ? "warning" : "info";
      findings.push({ ruleId: `reporting_health_${category.category}`, message: issue, severity });
    }
  }
  return findings;
}

export interface ComputeReportingHealthInput {
  allMetrics: ReportMetricDefinition[];
  templates: ReportTemplate[];
  reports: SavedReport[];
  snapshots: ReportSnapshot[];
  latestDiagnostics: ReportSourceDiagnostic[];
  recentDurationsMs: number[];
  evaluatedAt: string;
}

export function computeReportingHealth(input: ComputeReportingHealthInput): ReportingHealthReport {
  const categories: ReportingHealthCategoryScore[] = [
    computeMetricCoverageCategory(input.allMetrics),
    computeSourceAvailabilityCategory(input.latestDiagnostics),
    computeSourceFreshnessCategory(input.latestDiagnostics),
    computePermissionConfigurationCategory(input.allMetrics),
    computeTemplateCoverageCategory(input.templates),
    computeSnapshotIntegrityCategory(input.reports, input.snapshots),
    computePerformanceCategory(input.recentDurationsMs),
  ];

  const scored = categories.filter((c): c is ReportingHealthCategoryScore & { score: number } => c.score !== null);
  const overallScore = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);

  return { categories, overallScore, findings: findingsFromCategories(categories), evaluatedAt: input.evaluatedAt };
}
