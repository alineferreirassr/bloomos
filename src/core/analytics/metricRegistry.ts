import type { MetricCategory, MetricDefinition } from "@/types/analytics";

/**
 * Checkpoint 15, Step 1 — the Metrics Registry. Same shape as every other
 * registry in this codebase (`core/ai/skills/registry.ts`,
 * `core/automation/registry.ts`, `core/automation/actionRegistry.ts`,
 * `core/workflow/nodeRegistry.ts`): a private module-level `Map`, keyed by
 * the definition's own `id`, exposed only through register/unregister/get/
 * list functions — never a class, never exported directly. "Metrics must
 * self-register" (Step 1's own wording) means each module's own metric
 * file calls `registerMetric()` at its own load time, the same "self-
 * register" contract Skills/Automations/Workflow nodes already use.
 */
const metrics = new Map<string, MetricDefinition>();

export function registerMetric(definition: MetricDefinition): void {
  metrics.set(definition.id, definition);
}

export function unregisterMetric(id: string): void {
  metrics.delete(id);
}

export function getMetric(id: string): MetricDefinition | undefined {
  return metrics.get(id);
}

export function listMetrics(): MetricDefinition[] {
  return [...metrics.values()];
}

export function listMetricsByCategory(category: MetricCategory): MetricDefinition[] {
  return listMetrics().filter((metric) => metric.category === category);
}

/** Test-only — clears every registered metric so each test file starts from a clean registry, the same precedent `resetSkillRegistry()`/`resetCommandRegistry()` already establish. */
export function resetMetricRegistry(): void {
  metrics.clear();
}
