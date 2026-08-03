import type { EntityType } from "@/core/enums/entityType";

/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. Same
 * `{score, issues, notApplicableReason}` shape `types/businessHealth.ts`'s
 * `HealthCategoryScore` already established — "reuse existing Health
 * infrastructure" (the spec's own words) means reusing this exact contract,
 * not building a differently-shaped one.
 */
export const SEARCH_HEALTH_CATEGORIES = ["coverage", "index", "performance"] as const;
export type SearchHealthCategory = (typeof SEARCH_HEALTH_CATEGORIES)[number];

export interface SearchHealthCategoryScore {
  category: SearchHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface SearchHealthReport {
  categories: SearchHealthCategoryScore[];
  overallScore: number;
  uncoveredEntityTypes: EntityType[];
  recommendations: string[];
  evaluatedAt: string;
}
