import { describe, expect, it } from "vitest";
import { computeBusinessHealthScore, type BusinessHealthContext } from "@/core/analytics/businessHealthEngine";

function perfectContext(): BusinessHealthContext {
  return {
    finance: { overdueReceivablesRatio: 0, hasRevenueThisPeriod: true, netProfitMarginPercent: 30, cashFlowNegative: false },
    crm: { conversionRatePercent: 40, conversionTrendDown: false, leadCount: 10 },
    operations: { averageEventHealthScore: 100, lateTaskCount: 0 },
    inventory: { lowStockItemCount: 0, totalItemCount: 20 },
    team: { overdueTaskCount: 0, totalTaskCount: 20 },
    events: { atRiskEventCount: 0, totalActiveEventCount: 10 },
    payments: { failedPaymentCount: 0, overduePaymentCount: 0 },
    risk: { openCriticalRiskCount: 0, openWarningRiskCount: 0 },
  };
}

describe("computeBusinessHealthScore", () => {
  it("scores a perfectly healthy workspace at 100, band excellent", () => {
    const result = computeBusinessHealthScore(perfectContext());
    expect(result.score).toBe(100);
    expect(result.band).toBe("excellent");
  });

  it("always reports customerSatisfaction as null with an honest explanation, excluded from the weighted total", () => {
    const result = computeBusinessHealthScore(perfectContext());
    const csat = result.dimensions.find((d) => d.dimension === "customerSatisfaction");
    expect(csat?.score).toBeNull();
    expect(csat?.explanation).toMatch(/no customer satisfaction data source/i);
    // A null-scored dimension doesn't drag the perfect-context score down.
    expect(result.score).toBe(100);
  });

  it("deducts for overdue receivables and negative net margin in the finance dimension", () => {
    const context = perfectContext();
    context.finance = { overdueReceivablesRatio: 0.4, hasRevenueThisPeriod: true, netProfitMarginPercent: -10, cashFlowNegative: true };
    const result = computeBusinessHealthScore(context);
    const finance = result.dimensions.find((d) => d.dimension === "finance");
    expect(finance?.score).toBeLessThan(100);
    expect(finance?.factors.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("bands a badly deducted score as critical", () => {
    const context: BusinessHealthContext = {
      finance: { overdueReceivablesRatio: 0.9, hasRevenueThisPeriod: true, netProfitMarginPercent: -50, cashFlowNegative: true },
      crm: { conversionRatePercent: 2, conversionTrendDown: true, leadCount: 50 },
      operations: { averageEventHealthScore: 20, lateTaskCount: 10 },
      inventory: { lowStockItemCount: 15, totalItemCount: 20 },
      team: { overdueTaskCount: 15, totalTaskCount: 20 },
      events: { atRiskEventCount: 8, totalActiveEventCount: 10 },
      payments: { failedPaymentCount: 5, overduePaymentCount: 5 },
      risk: { openCriticalRiskCount: 3, openWarningRiskCount: 5 },
    };
    const result = computeBusinessHealthScore(context);
    expect(result.band).toBe("critical");
    expect(result.score).toBeLessThan(45);
  });

  it("never lets a single dimension's deductions push the overall score below 0", () => {
    const context = perfectContext();
    context.risk = { openCriticalRiskCount: 20, openWarningRiskCount: 20 };
    const result = computeBusinessHealthScore(context);
    expect(result.score).toBeGreaterThanOrEqual(0);
    const risk = result.dimensions.find((d) => d.dimension === "risk");
    expect(risk?.score).toBe(0);
  });

  it("every dimension carries a non-empty explanation regardless of score", () => {
    const result = computeBusinessHealthScore(perfectContext());
    expect(result.dimensions.every((d) => d.explanation.length > 0)).toBe(true);
    expect(result.dimensions).toHaveLength(9);
  });
});

describe("crm dimension with zero leads", () => {
  it("never penalizes a workspace with no leads at all — 'no data yet' is not '0% conversion'", () => {
    const context = perfectContext();
    context.crm = { conversionRatePercent: 0, conversionTrendDown: false, leadCount: 0 };
    const result = computeBusinessHealthScore(context);
    const crm = result.dimensions.find((d) => d.dimension === "crm");
    expect(crm?.score).toBe(100);
    expect(crm?.factors).toEqual([]);
    expect(result.score).toBe(100);
  });
});
