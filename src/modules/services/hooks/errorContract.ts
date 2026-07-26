import { NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, ConflictError } from "@/core/errors";
import type { DataResult } from "@/lib/data/result";

/**
 * The one error contract every Services hook shares — no hook interprets
 * failures on its own. A `DataResult` failure (the shape most repository
 * mutation methods return) and a thrown domain error (`NotFoundError`,
 * `UnauthorizedError`, ...) both end up classified into this same shape, so
 * a component only ever has one thing to render regardless of which path
 * produced the failure.
 */
export type ServiceHookErrorKind = "validation" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "unexpected";

export interface ServiceHookError {
  kind: ServiceHookErrorKind;
  message: string;
  fieldErrors?: Partial<Record<string, string>>;
}

/**
 * Thrown by `throwIfFailed` when a repository method returns
 * `{ success: false }`. Never thrown for anything else — this class exists
 * purely to carry the repository's own message/fieldErrors through
 * `useMutation`'s error channel unchanged, never rewritten.
 */
export class ServiceMutationError extends Error {
  readonly fieldErrors?: Partial<Record<string, string>>;

  constructor(message: string, fieldErrors?: Partial<Record<string, string>>) {
    super(message);
    this.name = "ServiceMutationError";
    this.fieldErrors = fieldErrors;
  }
}

/** Unwraps a `DataResult`, throwing `ServiceMutationError` on failure so every mutation hook's `error` state is populated the same way, whether the failure came from a validation rejection or a thrown domain error. */
export function throwIfFailed<T>(result: DataResult<T>): T {
  if (!result.success) {
    throw new ServiceMutationError(result.error, result.fieldErrors);
  }
  return result.data;
}

export function classifyThrownError(error: unknown): ServiceHookError {
  if (error instanceof ServiceMutationError) {
    return { kind: "validation", message: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof NotFoundError) return { kind: "not_found", message: error.message };
  if (error instanceof UnauthorizedError) return { kind: "unauthorized", message: error.message };
  if (error instanceof ForbiddenError) return { kind: "forbidden", message: error.message };
  if (error instanceof ValidationError) return { kind: "validation", message: error.message, fieldErrors: error.fieldErrors };
  if (error instanceof ConflictError) return { kind: "conflict", message: error.message };
  return { kind: "unexpected", message: error instanceof Error ? error.message : "Something went wrong." };
}

/**
 * Shared retry predicate for every query hook. A `not_found`/`unauthorized`/
 * `forbidden`/`validation`/`conflict` failure will look exactly the same on
 * a second attempt — retrying wastes a round trip and delays the error
 * reaching the user. Only a genuinely `unexpected` failure (a transient
 * network blip, an unrecognized error) gets a couple of extra attempts.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (classifyThrownError(error).kind !== "unexpected") return false;
  return failureCount < 2;
}
