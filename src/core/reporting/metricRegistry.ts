import type { ReportCategory } from "@/types/reporting";
import type { ReportMetricDefinition } from "@/types/reportMetric";

/**
 * v2.0 Checkpoint 42 — the canonical Report Metric Registry. Same shape as
 * `core/analytics/metricRegistry.ts` (Checkpoint 15) and every other
 * self-registering registry in this codebase (`core/ai/skills/registry.ts`,
 * `core/automation/registry.ts`, `core/search/registry.ts`): a private
 * module-level `Map`, keyed by the definition's own `id`, exposed only
 * through register/unregister/get/list. This is the ONE metric registry
 * the Report Builder reads from — see `core/reporting/metricAdapters.ts`
 * for how every metric already registered in the older, narrower
 * `core/analytics/metricRegistry.ts` becomes a member of this one too,
 * rather than being re-registered by hand.
 */
const metrics = new Map<string, ReportMetricDefinition>();

export function registerReportMetric(definition: ReportMetricDefinition): void {
  metrics.set(definition.id, definition);
}

export function unregisterReportMetric(id: string): void {
  metrics.delete(id);
}

export function getReportMetric(id: string): ReportMetricDefinition | undefined {
  return metrics.get(id);
}

export function listReportMetrics(): ReportMetricDefinition[] {
  return [...metrics.values()];
}

export function listReportMetricsByCategory(category: ReportCategory): ReportMetricDefinition[] {
  return listReportMetrics().filter((metric) => metric.category === category);
}

/** Test-only — clears every registered metric, the same precedent `resetMetricRegistry()`/`resetSkillRegistry()` already establish. */
export function resetReportMetricRegistry(): void {
  metrics.clear();
}
