import { NextResponse } from "next/server";
import { API_ERROR_STATUS } from "@/core/api/errors";
import type { ApiErrorCode, ApiSuccessBody, PaginationMeta } from "@/types/api";

/** Checkpoint 16, Step 1's own consistent JSON envelope — every successful response is `{data, meta?}`, every error response is `{error: {code, message}}`. A third-party integration never has to guess the response shape per endpoint. */
export function apiSuccess<T>(data: T, meta?: PaginationMeta, status = 200): NextResponse<ApiSuccessBody<T>> {
  return NextResponse.json(meta ? { data, meta } : { data }, { status });
}

export function apiErrorResponse(code: ApiErrorCode, message: string): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status: API_ERROR_STATUS[code] });
}
