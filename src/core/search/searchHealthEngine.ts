import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import { getSearchableEntities } from "@/core/search/registry";
import { getActiveSearchProvider } from "@/core/search/service";
import { nullSearchProvider } from "@/core/search/service";
import type { SearchHealthCategoryScore, SearchHealthReport } from "@/types/searchHealth";

/**
 * v2.0 Checkpoint 40 — reuses `core/search/registry.ts`'s own
 * `getSearchableEntities()` and `core/search/service.ts`'s own
 * `getActiveSearchProvider()` rather than re-deriving coverage/index state
 * a second way. Same category-score composite pattern
 * `businessHealthEngine.ts` already established for every other platform's
 * Health Panel.
 */

const COVERAGE_PENALTY_PER_UNCOVERED = 3;
const MIN_SCORE = 0;
const MAX_SCORE = 100;

function clampScore(score: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, score));
}

function computeCoverageCategory(): { category: SearchHealthCategoryScore; uncoveredEntityTypes: EntityType[] } {
  const registered = new Set(getSearchableEntities().map((c) => c.entityType));
  const uncovered = ENTITY_TYPES.filter((entityType) => !registered.has(entityType));
  const score = clampScore(MAX_SCORE - uncovered.length * COVERAGE_PENALTY_PER_UNCOVERED);

  return {
    category: {
      category: "coverage",
      score,
      issues: uncovered.length > 0 ? [`${uncovered.length} of ${ENTITY_TYPES.length} entity types aren't registered as searchable yet.`] : [],
      notApplicableReason: null,
    },
    uncoveredEntityTypes: uncovered,
  };
}

function computeIndexCategory(): SearchHealthCategoryScore {
  const isRealProvider = getActiveSearchProvider() !== nullSearchProvider;
  return {
    category: "index",
    score: isRealProvider ? 100 : 0,
    issues: isRealProvider ? [] : ["No real search provider is registered — every search returns zero results."],
    notApplicableReason: null,
  };
}

/**
 * Honestly `null` — nothing timed a search before this checkpoint (see
 * `searchAnalyticsEngine.ts`'s own doc comment on why `averageResultCount`
 * exists but a duration metric doesn't), so a "performance score" here
 * would be fabricated. Disclosed as not-applicable, the same discipline
 * `businessHealthEngine.ts` already uses for every category it can't
 * honestly compute yet.
 */
function computePerformanceCategory(): SearchHealthCategoryScore {
  return {
    category: "performance",
    score: null,
    issues: [],
    notApplicableReason: "No search-duration data has been recorded yet — SearchHistoryEntry doesn't track timing.",
  };
}

export function computeSearchHealth(evaluatedAt: string): SearchHealthReport {
  const { category: coverage, uncoveredEntityTypes } = computeCoverageCategory();
  const index = computeIndexCategory();
  const performance = computePerformanceCategory();

  const categories = [coverage, index, performance];
  const scored = categories.filter((c) => c.score !== null);
  const overallScore = scored.length > 0 ? Math.round(scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length) : 0;

  const recommendations: string[] = [];
  if (uncoveredEntityTypes.length > 0) {
    recommendations.push(`Register ${uncoveredEntityTypes.slice(0, 3).join(", ")}${uncoveredEntityTypes.length > 3 ? ", …" : ""} as searchable to close Global Search's coverage gap.`);
  }
  if (index.score === 0) {
    recommendations.push("Register a real SearchProvider via setActiveSearchProvider() — search currently returns no results workspace-wide.");
  }

  return { categories, overallScore, uncoveredEntityTypes, recommendations, evaluatedAt };
}
