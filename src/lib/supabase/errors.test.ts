import { describe, expect, it } from "vitest";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import {
  ConflictError,
  ForbiddenError,
  NetworkError,
  NotFoundError,
  UnauthorizedError,
  UnknownError,
  ValidationError,
} from "@/core/errors";

describe("normalizeSupabaseError", () => {
  it("maps a missing-session auth error to UnauthorizedError", () => {
    const result = normalizeSupabaseError({ name: "AuthSessionMissingError", message: "Auth session missing" });
    expect(result).toBeInstanceOf(UnauthorizedError);
  });

  it("maps a 401 status to UnauthorizedError", () => {
    const result = normalizeSupabaseError({ status: 401, message: "unauthorized" });
    expect(result).toBeInstanceOf(UnauthorizedError);
  });

  it("maps invalid login credentials to a user-friendly UnauthorizedError", () => {
    const result = normalizeSupabaseError({ name: "AuthApiError", status: 400, message: "Invalid login credentials" });
    expect(result).toBeInstanceOf(UnauthorizedError);
    expect(result.message).toBe("Incorrect email or password.");
  });

  it("maps a 403 status to ForbiddenError", () => {
    const result = normalizeSupabaseError({ status: 403, message: "forbidden" });
    expect(result).toBeInstanceOf(ForbiddenError);
  });

  it("maps Postgres unique_violation (23505) to ConflictError", () => {
    const result = normalizeSupabaseError({ code: "23505", message: "duplicate key value violates unique constraint" });
    expect(result).toBeInstanceOf(ConflictError);
  });

  it("maps Postgres foreign_key_violation (23503) to ConflictError", () => {
    const result = normalizeSupabaseError({ code: "23503", message: "violates foreign key constraint" });
    expect(result).toBeInstanceOf(ConflictError);
  });

  it("maps PostgREST no-rows (PGRST116) to NotFoundError", () => {
    const result = normalizeSupabaseError({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" });
    expect(result).toBeInstanceOf(NotFoundError);
  });

  it("maps Postgres insufficient_privilege (42501) to ForbiddenError", () => {
    const result = normalizeSupabaseError({ code: "42501", message: "permission denied for table workspaces" });
    expect(result).toBeInstanceOf(ForbiddenError);
  });

  it("maps not_null_violation (23502) to ValidationError", () => {
    const result = normalizeSupabaseError({ code: "23502", message: "null value in column violates not-null constraint" });
    expect(result).toBeInstanceOf(ValidationError);
  });

  it("maps check_violation (23514) to ValidationError", () => {
    const result = normalizeSupabaseError({ code: "23514", message: "new row violates check constraint" });
    expect(result).toBeInstanceOf(ValidationError);
  });

  it("maps a network/fetch-failure message to NetworkError", () => {
    const result = normalizeSupabaseError({ message: "fetch failed" });
    expect(result).toBeInstanceOf(NetworkError);
  });

  it("falls back to UnknownError for an unrecognized shape", () => {
    const result = normalizeSupabaseError({ message: "something bizarre happened" });
    expect(result).toBeInstanceOf(UnknownError);
  });

  it("falls back to UnknownError for a non-object input", () => {
    expect(normalizeSupabaseError("a plain string")).toBeInstanceOf(UnknownError);
    expect(normalizeSupabaseError(null)).toBeInstanceOf(UnknownError);
    expect(normalizeSupabaseError(undefined)).toBeInstanceOf(UnknownError);
  });

  it("never leaks raw Postgres/constraint details into the normalized message", () => {
    const result = normalizeSupabaseError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "workspace_members_workspace_user_unique"',
      details: "Key (workspace_id, user_id)=(ws_1, user_1) already exists.",
    });
    expect(result.message).not.toMatch(/constraint|Key \(/i);
  });

  it("preserves the original error as `cause` for developer diagnostics", () => {
    const original = { code: "23505", message: "duplicate key" };
    const result = normalizeSupabaseError(original);
    expect(result.cause).toBe(original);
  });
});
