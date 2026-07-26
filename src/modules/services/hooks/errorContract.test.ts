import { describe, expect, it } from "vitest";
import { NotFoundError, UnauthorizedError, ForbiddenError, ValidationError, ConflictError } from "@/core/errors";
import { classifyThrownError, throwIfFailed, shouldRetryQuery, ServiceMutationError } from "@/modules/services/hooks/errorContract";

describe("throwIfFailed", () => {
  it("returns the data unwrapped on success", () => {
    expect(throwIfFailed({ success: true, data: { id: "1" } })).toEqual({ id: "1" });
  });

  it("throws a ServiceMutationError carrying the repository's own message and fieldErrors on failure", () => {
    expect(() => throwIfFailed({ success: false, error: "Please fix the highlighted fields.", fieldErrors: { name: "Name is required" } })).toThrow(
      ServiceMutationError,
    );
    try {
      throwIfFailed({ success: false, error: "Not found." });
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceMutationError);
      expect((error as ServiceMutationError).message).toBe("Not found.");
    }
  });
});

describe("classifyThrownError", () => {
  it("classifies every domain error kind without rewriting its message", () => {
    expect(classifyThrownError(new ServiceMutationError("Bad input", { name: "required" }))).toEqual({ kind: "validation", message: "Bad input", fieldErrors: { name: "required" } });
    expect(classifyThrownError(new NotFoundError("Service not found"))).toEqual({ kind: "not_found", message: "Service not found" });
    expect(classifyThrownError(new UnauthorizedError("Sign in required"))).toEqual({ kind: "unauthorized", message: "Sign in required" });
    expect(classifyThrownError(new ForbiddenError("Not allowed"))).toEqual({ kind: "forbidden", message: "Not allowed" });
    expect(classifyThrownError(new ValidationError("Invalid", { field: "bad" }))).toEqual({ kind: "validation", message: "Invalid", fieldErrors: { field: "bad" } });
    expect(classifyThrownError(new ConflictError("Already published"))).toEqual({ kind: "conflict", message: "Already published" });
  });

  it("falls back to 'unexpected' for anything unrecognized, never guessing a more specific kind", () => {
    expect(classifyThrownError(new Error("network blip"))).toEqual({ kind: "unexpected", message: "network blip" });
    expect(classifyThrownError("a plain string")).toEqual({ kind: "unexpected", message: "Something went wrong." });
  });
});

describe("shouldRetryQuery", () => {
  it("never retries a client/business error — retrying can't fix a 404 or a validation rejection", () => {
    expect(shouldRetryQuery(0, new NotFoundError("gone"))).toBe(false);
    expect(shouldRetryQuery(0, new ServiceMutationError("bad input"))).toBe(false);
  });

  it("retries an unexpected error up to 2 times, then stops", () => {
    expect(shouldRetryQuery(0, new Error("network blip"))).toBe(true);
    expect(shouldRetryQuery(1, new Error("network blip"))).toBe(true);
    expect(shouldRetryQuery(2, new Error("network blip"))).toBe(false);
  });
});
