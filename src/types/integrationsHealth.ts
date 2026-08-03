/**
 * v2 Checkpoint 43 — the same `{score, issues, notApplicableReason}`
 * shape `types/businessHealth.ts`'s `HealthCategoryScore` established,
 * reused by `types/searchHealth.ts`/`types/notificationHealth.ts`/
 * `types/reportingHealth.ts` — this is that same contract again, not a
 * differently-shaped one.
 */
export const INTEGRATIONS_HEALTH_CATEGORIES = ["connection_status", "authentication", "webhook_health", "sync_health", "error_rate", "mapping_integrity"] as const;
export type IntegrationsHealthCategory = (typeof INTEGRATIONS_HEALTH_CATEGORIES)[number];

export interface IntegrationsHealthCategoryScore {
  category: IntegrationsHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface IntegrationsHealthReport {
  categories: IntegrationsHealthCategoryScore[];
  overallScore: number;
  connectionCount: number;
  connectedCount: number;
  staleConnectionCount: number;
  expiringSoonCount: number;
  recommendations: string[];
  evaluatedAt: string;
}
