import { describe, expect, it } from "vitest";
import { parseTrendWindow } from "@/core/api/trendWindow";
import { ApiError } from "@/core/api/errors";
import { TREND_WINDOW_KEYS } from "@/types/analytics";

describe("parseTrendWindow", () => {
  it('defaults to "30d" when ?window= is absent', () => {
    expect(parseTrendWindow(new URL("http://localhost/api/v1/analytics/summary"))).toBe("30d");
  });

  it("accepts every declared TrendWindowKey", () => {
    for (const key of TREND_WINDOW_KEYS) {
      expect(parseTrendWindow(new URL(`http://localhost/api/v1/analytics/summary?window=${key}`))).toBe(key);
    }
  });

  it("throws an invalid_request ApiError for an unrecognized window value", () => {
    expect(() => parseTrendWindow(new URL("http://localhost/api/v1/analytics/summary?window=decade"))).toThrow(ApiError);
    try {
      parseTrendWindow(new URL("http://localhost/api/v1/analytics/summary?window=decade"));
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("invalid_request");
    }
  });
});
