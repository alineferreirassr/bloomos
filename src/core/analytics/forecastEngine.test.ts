import { describe, expect, it } from "vitest";
import { forecastLinearRegression, forecastMovingAverage } from "@/core/analytics/forecastEngine";

describe("forecastLinearRegression", () => {
  it("returns no projection and low confidence when there's no historical data", () => {
    const result = forecastLinearRegression([], 3);
    expect(result.projected).toEqual([]);
    expect(result.confidence).toBe("low");
  });

  it("holds a single historical point flat rather than fabricating a trend", () => {
    const result = forecastLinearRegression([{ label: "2026-05", value: 1000 }], 2);
    expect(result.projected).toEqual([
      { label: "2026-06", value: 1000 },
      { label: "2026-07", value: 1000 },
    ]);
    expect(result.confidence).toBe("low");
  });

  it("fits a clean upward line and extrapolates it forward, never below zero", () => {
    const historical = [
      { label: "2026-01", value: 1000 },
      { label: "2026-02", value: 2000 },
      { label: "2026-03", value: 3000 },
      { label: "2026-04", value: 4000 },
    ];
    const result = forecastLinearRegression(historical, 2);
    expect(result.projected).toEqual([
      { label: "2026-05", value: 5000 },
      { label: "2026-06", value: 6000 },
    ]);
    expect(result.confidence).toBe("medium");
  });

  it("reaches high confidence at 6+ historical points", () => {
    const historical = Array.from({ length: 6 }, (_, i) => ({ label: `2026-0${i + 1}`, value: 100 * (i + 1) }));
    expect(forecastLinearRegression(historical, 1).confidence).toBe("high");
  });

  it("floors a declining projection at zero rather than going negative", () => {
    const historical = [
      { label: "2026-01", value: 300 },
      { label: "2026-02", value: 200 },
      { label: "2026-03", value: 100 },
    ];
    const result = forecastLinearRegression(historical, 3);
    expect(result.projected.every((p) => p.value >= 0)).toBe(true);
    expect(result.projected[2].value).toBe(0);
  });
});

describe("forecastMovingAverage", () => {
  it("projects the trailing window's average held flat", () => {
    const historical = [
      { label: "2026-01", value: 100 },
      { label: "2026-02", value: 200 },
      { label: "2026-03", value: 300 },
    ];
    const result = forecastMovingAverage(historical, 2, 3);
    expect(result.projected).toEqual([
      { label: "2026-04", value: 200 },
      { label: "2026-05", value: 200 },
    ]);
    expect(result.method).toBe("moving_average");
  });

  it("returns no projection when there's no historical data", () => {
    expect(forecastMovingAverage([], 3).projected).toEqual([]);
  });
});
