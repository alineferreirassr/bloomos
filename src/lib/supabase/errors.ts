import {
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  UnauthorizedError,
  UnknownError,
  ValidationError,
} from "@/core/errors";

/**
 * Normalizes Supabase Auth errors (`AuthError` — has `status`/`name`) and
 * PostgREST/Postgres errors (has `code`) into this app's own typed error
 * taxonomy (`core/errors`). Never rethrow a raw Supabase/Postgres error to
 * a caller that renders to the end user — route it through this first so
 * database internals (constraint names, table names, SQL state details)
 * never reach the UI. Developer logs may still capture the original error
 * as `cause` for diagnostics.
 */
export function normalizeSupabaseError(error: unknown): Error {
  if (typeof error !== "object" || error === null) {
    return new UnknownError("Something went wrong. Please try again.");
  }

  const err = error as { status?: unknown; name?: unknown; code?: unknown; message?: unknown };
  const status = typeof err.status === "number" ? err.status : undefined;
  const name = typeof err.name === "string" ? err.name : undefined;
  const code = typeof err.code === "string" ? err.code : undefined;
  const message = typeof err.message === "string" ? err.message : undefined;

  if (name === "AuthSessionMissingError" || status === 401) {
    return withCause(new UnauthorizedError("Authentication is required."), error);
  }
  if (status === 403) {
    return withCause(new ForbiddenError("You don't have permission to do that."), error);
  }
  if (name === "AuthApiError" && status === 400 && /invalid login credentials/i.test(message ?? "")) {
    return withCause(new UnauthorizedError("Incorrect email or password."), error);
  }

  switch (code) {
    case "23505":
      return withCause(new ConflictError("That record already exists."), error);
    case "23503":
      return withCause(new ConflictError("This action would affect a related record that still exists."), error);
    case "PGRST116":
      return withCause(new NotFoundError("The requested record was not found."), error);
    case "42501":
      return withCause(new ForbiddenError("You don't have permission to do that."), error);
    case "23502":
    case "23514":
      return withCause(new ValidationError("The submitted data is invalid."), error);
    default:
      break;
  }

  if (message && /fetch failed|network|ECONNREFUSED|ENOTFOUND|timed? ?out/i.test(message)) {
    return withCause(new NetworkError("Could not reach the server. Check your connection and try again."), error);
  }

  return withCause(new UnknownError("Something went wrong. Please try again."), error);
}

function withCause(appError: Error, cause: unknown): Error {
  appError.cause = cause;
  return appError;
}
