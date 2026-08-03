/**
 * v2.0 Checkpoint 42 — Reporting Health. Same `{score, issues,
 * notApplicableReason}` `HealthCategoryScore` contract every domain-level
 * Health Engine in this codebase already uses (`types/businessHealth.ts`,
 * mirrored by `types/searchHealth.ts`, `types/notificationHealth.ts`, and
 * now this file) — never a differently-shaped one.
 */
export const REPORTING_HEALTH_CATEGORIES = [
  "metric_coverage",
  "source_availability",
  "source_freshness",
  "permission_configuration",
  "template_coverage",
  "snapshot_integrity",
  "performance",
] as const;
export type ReportingHealthCategory = (typeof REPORTING_HEALTH_CATEGORIES)[number];

export interface ReportingHealthCategoryScore {
  category: ReportingHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface ReportingFinding {
  ruleId: string;
  message: string;
  severity: "critical" | "warning" | "info";
}

export interface ReportingHealthReport {
  categories: ReportingHealthCategoryScore[];
  overallScore: number;
  findings: ReportingFinding[];
  evaluatedAt: string;
}
