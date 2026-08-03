import type { ApiScope } from "@/types/apiScope";

/** Checkpoint 16, Step 1 — the Public API's own closed set of error codes, each with a fixed HTTP status (`core/api/errors.ts`'s own mapping) — a third-party integration can branch on `error.code` without parsing prose. */
export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "invalid_request",
  "rate_limited",
  "internal_error",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ApiSuccessBody<T> {
  data: T;
  meta?: PaginationMeta;
}

/** Step 2/3's own resolved auth — the one thing every route handler receives once `resolveApiAuth()` succeeds; never re-derived per-endpoint. */
export interface ApiAuthContext {
  apiKeyId: string;
  workspaceId: string;
  scopes: ApiScope[];
}
