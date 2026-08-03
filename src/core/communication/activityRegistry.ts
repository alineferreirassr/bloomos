import type { ActivitySourceAdapter } from "@/types/communication";

/**
 * v2.0 Checkpoint 24, Step 7/7.5 — Activity Registry. The exact `Map`-based
 * register/unregister/list/reset shape every other registry in this
 * codebase uses (`core/ai/skills/registry.ts`, `core/automation/registry.ts`,
 * `core/analytics/metricRegistry.ts`). Each registered source is one
 * `ActivitySourceAdapter` — a function that knows how to read one domain's
 * own store and normalize its rows into `ActivityEntry[]`. "Every future
 * integration must feed this Timeline automatically" (spec, Step 7.5) means:
 * a future Email/SMS provider registers one more adapter here — the
 * Aggregator, the Feed, and the Timeline UI never change.
 */

const sources = new Map<string, ActivitySourceAdapter>();

export function registerActivitySource(id: string, adapter: ActivitySourceAdapter): void {
  sources.set(id, adapter);
}

export function unregisterActivitySource(id: string): void {
  sources.delete(id);
}

export function getActivitySources(): ActivitySourceAdapter[] {
  return Array.from(sources.values());
}

export function listActivitySourceIds(): string[] {
  return Array.from(sources.keys());
}

/** Test-only: restore the registry to empty between test cases. */
export function resetActivityRegistry(): void {
  sources.clear();
}
