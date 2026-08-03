import { computeHealthSnapshot } from "@/core/integrations/healthMonitor";
import { listMappingsForConnection } from "@/lib/data/core/integrations/mappingStore";
import { countRecentErrorsForConnection } from "@/lib/data/core/integrations/errorRecordStore";
import { nowIso } from "@/lib/data/utils";
import type { IntegrationConnection, IntegrationCredential } from "@/core/integrations/types";
import type { IntegrationsHealthCategory, IntegrationsHealthCategoryScore, IntegrationsHealthReport } from "@/types/integrationsHealth";

const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days with no sync
const TOKEN_EXPIRING_SOON_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ERROR_RATE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * v2 Checkpoint 43 — Integration Health. Every score here is derived from
 * real per-connection signals the platform already tracks (`healthMonitor.
 * computeHealthSnapshot`, `IntegrationMapping`/`IntegrationErrorRecord`
 * stores) — no simulated flag. A workspace with zero connections isn't
 * "unhealthy," it's `notApplicableReason`-flagged honestly, the same
 * discipline every other Health engine in this codebase follows.
 */
export function computeIntegrationsHealth(params: { connections: IntegrationConnection[]; credentialsByConnectionId: Map<string, IntegrationCredential | null> }): IntegrationsHealthReport {
  const { connections, credentialsByConnectionId } = params;
  const now = Date.now();
  const categories: IntegrationsHealthCategoryScore[] = [];
  const recommendations: string[] = [];

  if (connections.length === 0) {
    for (const category of ["connection_status", "authentication", "webhook_health", "sync_health", "error_rate", "mapping_integrity"] as IntegrationsHealthCategory[]) {
      categories.push({ category, score: null, issues: [], notApplicableReason: "No providers are connected yet." });
    }
    return { categories, overallScore: 0, connectionCount: 0, connectedCount: 0, staleConnectionCount: 0, expiringSoonCount: 0, recommendations: ["Connect a provider to start tracking Integration Health."], evaluatedAt: nowIso() };
  }

  const connectedCount = connections.filter((c) => c.state === "connected").length;
  const connectionStatusIssues = connections.filter((c) => c.state === "failed" || c.state === "expired").map((c) => `${c.provider_id} connection is ${c.state}.`);
  categories.push({ category: "connection_status", score: Math.round((connectedCount / connections.length) * 100), issues: connectionStatusIssues, notApplicableReason: null });

  let expiringSoonCount = 0;
  const authIssues: string[] = [];
  for (const connection of connections) {
    const credential = credentialsByConnectionId.get(connection.id) ?? null;
    const snapshot = computeHealthSnapshot(connection, credential);
    if (snapshot.token_expires_at) {
      const expiresInMs = new Date(snapshot.token_expires_at).getTime() - now;
      if (expiresInMs < 0) authIssues.push(`${connection.provider_id}'s token has expired.`);
      else if (expiresInMs < TOKEN_EXPIRING_SOON_MS) {
        expiringSoonCount += 1;
        authIssues.push(`${connection.provider_id}'s token expires within 7 days.`);
      }
    }
    if (!connection.credential_id) authIssues.push(`${connection.provider_id} has no credential attached.`);
  }
  categories.push({ category: "authentication", score: Math.max(0, 100 - authIssues.length * 15), issues: authIssues, notApplicableReason: null });

  const webhookCapableConnections = connections.filter((c) => c.capabilities.includes("webhook"));
  categories.push({
    category: "webhook_health",
    score: webhookCapableConnections.length === 0 ? null : 100,
    issues: [],
    notApplicableReason: webhookCapableConnections.length === 0 ? "No connected providers declare webhook support." : null,
  });

  let staleConnectionCount = 0;
  const syncIssues: string[] = [];
  for (const connection of connections) {
    if (!connection.last_sync_at) continue;
    const sinceLastSyncMs = now - new Date(connection.last_sync_at).getTime();
    if (sinceLastSyncMs > STALE_THRESHOLD_MS) {
      staleConnectionCount += 1;
      syncIssues.push(`${connection.provider_id} hasn't synced in over 30 days.`);
    }
  }
  categories.push({ category: "sync_health", score: Math.max(0, 100 - staleConnectionCount * 20), issues: syncIssues, notApplicableReason: null });

  const sinceIso = new Date(now - ERROR_RATE_WINDOW_MS).toISOString();
  let totalRecentErrors = 0;
  const errorIssues: string[] = [];
  for (const connection of connections) {
    const count = countRecentErrorsForConnection(connection.id, sinceIso);
    totalRecentErrors += count;
    if (count > 5) errorIssues.push(`${connection.provider_id} logged ${count} errors in the last 24h.`);
  }
  categories.push({ category: "error_rate", score: Math.max(0, 100 - totalRecentErrors * 5), issues: errorIssues, notApplicableReason: null });

  const mappingIssues: string[] = [];
  for (const connection of connections) {
    const mappings = listMappingsForConnection(connection.id);
    const orphaned = mappings.filter((mapping) => !mapping.last_synced_at);
    if (orphaned.length > 0) mappingIssues.push(`${connection.provider_id} has ${orphaned.length} mapping(s) never confirmed synced.`);
  }
  categories.push({ category: "mapping_integrity", score: Math.max(0, 100 - mappingIssues.length * 10), issues: mappingIssues, notApplicableReason: null });

  const scored = categories.filter((c) => c.score !== null);
  const overallScore = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length);

  if (expiringSoonCount > 0) recommendations.push(`${expiringSoonCount} connection(s) have a token expiring within 7 days — reconnect before they lapse.`);
  if (staleConnectionCount > 0) recommendations.push(`${staleConnectionCount} connection(s) haven't synced in over 30 days — verify they're still needed.`);
  if (connectionStatusIssues.length > 0) recommendations.push("One or more connections are failed or expired — reconnect them from the Connection Center.");

  return { categories, overallScore, connectionCount: connections.length, connectedCount, staleConnectionCount, expiringSoonCount, recommendations, evaluatedAt: nowIso() };
}
