import { describe, expect, it } from "vitest";
import { computeEffectiveInterval, computeBufferOverlapMinutes, hasBufferConflict } from "@/core/scheduling/bufferEngine";

describe("computeEffectiveInterval", () => {
  it("extends starts_at backward by preparation_minutes and ends_at forward by cleanup_minutes", () => {
    const result = computeEffectiveInterval({ starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", preparation_minutes: 15, cleanup_minutes: 30 });
    expect(result).toEqual({ effectiveStart: "2026-08-03T09:45:00.000Z", effectiveEnd: "2026-08-03T11:30:00.000Z" });
  });

  it("is a no-op with zero buffers", () => {
    const result = computeEffectiveInterval({ starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", preparation_minutes: 0, cleanup_minutes: 0 });
    expect(result).toEqual({ effectiveStart: "2026-08-03T10:00:00.000Z", effectiveEnd: "2026-08-03T11:00:00.000Z" });
  });
});

describe("computeBufferOverlapMinutes / hasBufferConflict", () => {
  it("reports zero overlap for appointments with a real gap between buffers", () => {
    const a = { starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", preparation_minutes: 0, cleanup_minutes: 0 };
    const b = { starts_at: "2026-08-03T11:30:00.000Z", ends_at: "2026-08-03T12:00:00.000Z", preparation_minutes: 0, cleanup_minutes: 0 };
    expect(computeBufferOverlapMinutes(a, b)).toBe(0);
    expect(hasBufferConflict(a, b)).toBe(false);
  });

  it("detects a conflict when cleanup time from one appointment collides with the next appointment's core time", () => {
    const a = { starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", preparation_minutes: 0, cleanup_minutes: 30 };
    const b = { starts_at: "2026-08-03T11:15:00.000Z", ends_at: "2026-08-03T12:00:00.000Z", preparation_minutes: 0, cleanup_minutes: 0 };
    expect(hasBufferConflict(a, b)).toBe(true);
    expect(computeBufferOverlapMinutes(a, b)).toBe(15);
  });

  it("detects a conflict when preparation time collides with the prior appointment's core time", () => {
    const a = { starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", preparation_minutes: 0, cleanup_minutes: 0 };
    const b = { starts_at: "2026-08-03T11:20:00.000Z", ends_at: "2026-08-03T12:00:00.000Z", preparation_minutes: 30, cleanup_minutes: 0 };
    expect(hasBufferConflict(a, b)).toBe(true);
    expect(computeBufferOverlapMinutes(a, b)).toBe(10);
  });

  it("treats back-to-back buffered intervals (touching, not overlapping) as no conflict", () => {
    const a = { starts_at: "2026-08-03T10:00:00.000Z", ends_at: "2026-08-03T11:00:00.000Z", preparation_minutes: 0, cleanup_minutes: 15 };
    const b = { starts_at: "2026-08-03T11:15:00.000Z", ends_at: "2026-08-03T12:00:00.000Z", preparation_minutes: 0, cleanup_minutes: 0 };
    expect(hasBufferConflict(a, b)).toBe(false);
  });
});
