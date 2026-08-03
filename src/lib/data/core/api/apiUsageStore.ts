import { generateId, nowIso } from "@/lib/data/utils";
import { getGlobalMockStore } from "@/lib/data/core/globalMockStore";

export interface ApiRequestLogEntry {
  id: string;
  workspace_id: string;
  api_key_id: string | null;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  occurred_at: string;
}

/**
 * Checkpoint 16, Step 12 — "Track: API requests... Usage by endpoint." A
 * real, persisted (mock-only) record of every request `createApiHandler`
 * processes, regardless of outcome (success, scope denial, auth failure,
 * rate limit) — the Developer Console's own "Usage" tab reads straight
 * off this, the same "one write path, real read surface" precedent
 * `clientPortalActivityStore.ts` already established for Client Portal
 * Activity.
 *
 * Backed by `getGlobalMockStore` (not a plain `let`) — every write happens
 * from a Route Handler, every read happens from the Developer Console's
 * Server Action, two independently-compiled module graphs in Next.js's
 * dev server. See that module's own doc comment.
 */
const store = getGlobalMockStore<ApiRequestLogEntry[]>("apiUsageStore.entries", () => []);

export function resetApiUsageStore(): void {
  store.set([]);
}

export function recordApiRequestLog(input: Omit<ApiRequestLogEntry, "id" | "occurred_at">): void {
  store.set([...store.get(), { id: generateId("api-request-log"), occurred_at: nowIso(), ...input }]);
}

export function listApiRequestLogsForWorkspace(workspaceId: string, limit = 500): ApiRequestLogEntry[] {
  return store
    .get()
    .filter((entry) => entry.workspace_id === workspaceId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .slice(0, limit);
}

export interface ApiUsageSummary {
  totalRequests: number;
  errorCount: number;
  averageDurationMs: number;
  byEndpoint: { path: string; method: string; count: number; errorCount: number }[];
}

/** Aggregates the same records `listApiRequestLogsForWorkspace` returns — never a second, independently-maintained counter that could drift from the raw log. */
export function summarizeApiUsage(workspaceId: string): ApiUsageSummary {
  const logs = store.get().filter((entry) => entry.workspace_id === workspaceId);
  const errorCount = logs.filter((entry) => entry.status_code >= 400).length;
  const averageDurationMs = logs.length === 0 ? 0 : Math.round(logs.reduce((sum, entry) => sum + entry.duration_ms, 0) / logs.length);

  const byEndpointMap = new Map<string, { path: string; method: string; count: number; errorCount: number }>();
  for (const entry of logs) {
    const key = `${entry.method} ${entry.path}`;
    const existing = byEndpointMap.get(key) ?? { path: entry.path, method: entry.method, count: 0, errorCount: 0 };
    existing.count += 1;
    if (entry.status_code >= 400) existing.errorCount += 1;
    byEndpointMap.set(key, existing);
  }

  return { totalRequests: logs.length, errorCount, averageDurationMs, byEndpoint: [...byEndpointMap.values()].sort((a, b) => b.count - a.count) };
}
