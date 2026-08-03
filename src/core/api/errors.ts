import type { ApiErrorCode } from "@/types/api";

/** Checkpoint 16, Step 1 — one fixed HTTP status per `ApiErrorCode`, the single source of truth every route handler and `createApiHandler` share, so a status code and its own error body's `code` field can never drift apart. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  rate_limited: 429,
  internal_error: 500,
};

/** Thrown by a route handler's own logic (e.g. "no invoice with that id") — `createApiHandler` catches this specific type and turns it into the matching JSON error response; any other thrown value becomes a generic `internal_error`, never leaking an internal stack trace to a third party. */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ApiError";
  }
}
