import { getLogger } from "@/core/observability/logger";
import { recordApiRequestLog } from "@/lib/data/core/api/apiUsageStore";

export interface RecordApiRequestParams {
  workspaceId: string | null;
  apiKeyId: string | null;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
}

/**
 * Checkpoint 16, Step 12 — one call site for every observability
 * requirement at once: "API requests," "Latency" (`durationMs`),
 * "Errors"/"Authentication failures" (`statusCode` alone tells the
 * difference — 401/403 vs. 5xx — without a second code path),
 * "Rate-limit events" (`statusCode === 429`), and "Usage by endpoint"
 * (persisted via `recordApiRequestLog`, read back by the Developer
 * Console). Every request `createApiHandler` processes reaches this
 * exactly once, success or failure, matching the structured-logging
 * convention (`"<Domain event>", {context}`) every other Engine in this
 * codebase already uses.
 */
export function recordApiRequest(params: RecordApiRequestParams): void {
  const message =
    params.statusCode === 401
      ? "API authentication failed"
      : params.statusCode === 429
        ? "API rate limit exceeded"
        : params.statusCode >= 400
          ? "API request failed"
          : "API request completed";
  const logContext = { workspaceId: params.workspaceId, apiKeyId: params.apiKeyId, method: params.method, path: params.path, statusCode: params.statusCode, durationMs: params.durationMs };
  if (params.statusCode >= 500) getLogger().error(message, logContext);
  else if (params.statusCode >= 400) getLogger().warn(message, logContext);
  else getLogger().info(message, logContext);

  if (params.workspaceId) {
    recordApiRequestLog({ workspace_id: params.workspaceId, api_key_id: params.apiKeyId, method: params.method, path: params.path, status_code: params.statusCode, duration_ms: params.durationMs });
  }
}
