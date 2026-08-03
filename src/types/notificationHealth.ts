/**
 * v2.0 Checkpoint 41 — Notification Center. Same `{score, issues,
 * notApplicableReason}` shape `types/businessHealth.ts`'s
 * `HealthCategoryScore` already established, mirrored exactly the way
 * `types/searchHealth.ts` did for Checkpoint 40 — "follow Business Health
 * conventions" (the checkpoint's own words) means reusing this contract.
 */
export const NOTIFICATION_HEALTH_CATEGORIES = ["delivery_readiness", "template_coverage", "routing_health", "preference_health", "configuration_health"] as const;
export type NotificationHealthCategory = (typeof NOTIFICATION_HEALTH_CATEGORIES)[number];

export interface NotificationHealthCategoryScore {
  category: NotificationHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface NotificationFinding {
  ruleId: string;
  message: string;
  severity: "critical" | "warning" | "info";
}

export interface NotificationHealthReport {
  categories: NotificationHealthCategoryScore[];
  overallScore: number;
  findings: NotificationFinding[];
  evaluatedAt: string;
}
