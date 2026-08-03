import { type NextRequest, NextResponse } from "next/server";
import { resolveApiAuth } from "@/core/api/auth";
import { checkRateLimit } from "@/core/api/rateLimit";
import { recordApiRequest } from "@/core/api/observability";
import { apiErrorResponse } from "@/core/api/response";
import { ApiError, API_ERROR_STATUS } from "@/core/api/errors";
import { getLogger } from "@/core/observability/logger";
import type { ApiAuthContext } from "@/types/api";
import type { ApiScope } from "@/types/apiScope";

export type ApiRouteHandler<TParams> = (request: NextRequest, auth: ApiAuthContext, params: TParams) => Promise<NextResponse>;

/**
 * Checkpoint 16 — the one seam every `/api/v1/*` route handler is built
 * through, the same role `executeSkill()`/`resolveMemberSessionSnapshot()`
 * play for internal Server Actions. Handles, in fixed order, every cross-
 * cutting Step this checkpoint calls for: authentication (Step 2), scope
 * validation (Step 3), the rate-limit hook (Step 1), error normalization
 * (Step 1 — a thrown `ApiError` maps to its own code/status, anything else
 * becomes a generic `internal_error` that never leaks an internal message
 * to a third party), and observability (Step 12 — exactly one
 * `recordApiRequest` call per request, on every exit path, success or
 * failure). An individual route file's own job shrinks to "what scope do I
 * need, and how do I read the data" — nothing else.
 */
export function createApiHandler<TParams = Record<string, never>>(requiredScope: ApiScope, handler: ApiRouteHandler<TParams>) {
  return async function (request: NextRequest, context?: { params: Promise<TParams> }): Promise<NextResponse> {
    const started = Date.now();
    const path = new URL(request.url).pathname;
    const method = request.method;

    const authResult = await resolveApiAuth(request);
    if (authResult.kind === "error") {
      recordApiRequest({ workspaceId: null, apiKeyId: null, method, path, statusCode: 401, durationMs: Date.now() - started });
      return apiErrorResponse("unauthorized", authResult.message);
    }
    const { auth } = authResult;

    if (!auth.scopes.includes(requiredScope)) {
      recordApiRequest({ workspaceId: auth.workspaceId, apiKeyId: auth.apiKeyId, method, path, statusCode: 403, durationMs: Date.now() - started });
      return apiErrorResponse("forbidden", `This API Key does not have the required "${requiredScope}" scope.`);
    }

    const rateLimitDecision = await checkRateLimit(auth.apiKeyId);
    if (!rateLimitDecision.allowed) {
      recordApiRequest({ workspaceId: auth.workspaceId, apiKeyId: auth.apiKeyId, method, path, statusCode: 429, durationMs: Date.now() - started });
      return apiErrorResponse("rate_limited", "Too many requests. Please slow down and try again.");
    }

    try {
      const params = context ? await context.params : ({} as TParams);
      const response = await handler(request, auth, params);
      recordApiRequest({ workspaceId: auth.workspaceId, apiKeyId: auth.apiKeyId, method, path, statusCode: response.status, durationMs: Date.now() - started });
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        recordApiRequest({ workspaceId: auth.workspaceId, apiKeyId: auth.apiKeyId, method, path, statusCode: API_ERROR_STATUS[error.code], durationMs: Date.now() - started });
        return apiErrorResponse(error.code, error.message);
      }
      getLogger().error("Unhandled Public API error", { path, method, error: error instanceof Error ? error.message : "Unknown error" });
      recordApiRequest({ workspaceId: auth.workspaceId, apiKeyId: auth.apiKeyId, method, path, statusCode: 500, durationMs: Date.now() - started });
      return apiErrorResponse("internal_error", "Something went wrong processing this request.");
    }
  };
}

// Re-exported so a route file only ever imports from this one module for its own boilerplate.
export { NextResponse };
