import { describe, expect, it } from "vitest";
import { ApiError, API_ERROR_STATUS } from "@/core/api/errors";
import { API_ERROR_CODES } from "@/types/api";

describe("ApiError", () => {
  it("carries its own code and message", () => {
    const error = new ApiError("not_found", "No client with that id.");
    expect(error.code).toBe("not_found");
    expect(error.message).toBe("No client with that id.");
  });

  it("is a real Error instance, catchable like any other thrown value", () => {
    expect(() => {
      throw new ApiError("invalid_request", "Bad request.");
    }).toThrow(Error);
  });
});

describe("API_ERROR_STATUS", () => {
  it("maps every declared error code to a status, and only real HTTP error statuses", () => {
    for (const code of API_ERROR_CODES) {
      expect(API_ERROR_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(API_ERROR_STATUS[code]).toBeLessThan(600);
    }
  });

  it("maps each code to its documented status", () => {
    expect(API_ERROR_STATUS.unauthorized).toBe(401);
    expect(API_ERROR_STATUS.forbidden).toBe(403);
    expect(API_ERROR_STATUS.not_found).toBe(404);
    expect(API_ERROR_STATUS.invalid_request).toBe(400);
    expect(API_ERROR_STATUS.rate_limited).toBe(429);
    expect(API_ERROR_STATUS.internal_error).toBe(500);
  });
});
