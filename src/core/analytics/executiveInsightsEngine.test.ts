import { describe, expect, it } from "vitest";
import { generateExecutiveInsights, type ExecutiveInsightsContext } from "@/core/analytics/executiveInsightsEngine";
import { EXECUTIVE_INSIGHT_CATEGORIES } from "@/types/businessIntelligence";

function baseContext(): ExecutiveInsightsContext {
  return {
    revenue: { thisMonthMinor: 500000, lastMonthMinor: 400000, currency: "usd" },
    expenses: { thisMonthMinor: 100000, lastMonthMinor: 90000, currency: "usd" },
    pipeline: { openLeadCount: 5, pipelineValueMinor: 1000000, conversionRatePercent: 25, currency: "usd" },
    risk: { criticalRiskCount: 0, overdueInvoiceCount: 0, overdueInvoiceTotalMinor: 0, currency: "usd" },
    growth: { newClientsThisMonth: 3, newClientsLastMonth: 2 },
    clientTrend: { vipClientCount: 4, inactiveClientCount: 1 },
    operational: { lowStockItemCount: 0, unassignedRequirementCount: 0 },
  };
}

describe("generateExecutiveInsights", () => {
  it("produces exactly one insight per spec category", () => {
    const insights = generateExecutiveInsights(baseContext());
    expect(insights.map((i) => i.category).sort()).toEqual([...EXECUTIVE_INSIGHT_CATEGORIES].sort());
  });

  it("every insight carries a non-empty title and detail", () => {
    const insights = generateExecutiveInsights(baseContext());
    expect(insights.every((i) => i.title.length > 0 && i.detail.length > 0)).toBe(true);
  });

  it("flags revenue as positive when up vs. last month, warning when down", () => {
    const up = generateExecutiveInsights(baseContext()).find((i) => i.id === "revenue");
    expect(up?.severity).toBe("positive");

    const context = baseContext();
    context.revenue = { thisMonthMinor: 300000, lastMonthMinor: 500000, currency: "usd" };
    const down = generateExecutiveInsights(context).find((i) => i.id === "revenue");
    expect(down?.severity).toBe("warning");
  });

  it("escalates risk severity to critical when there are open critical risks", () => {
    const context = baseContext();
    context.risk = { criticalRiskCount: 2, overdueInvoiceCount: 0, overdueInvoiceTotalMinor: 0, currency: "usd" };
    const insight = generateExecutiveInsights(context).find((i) => i.category === "risk");
    expect(insight?.severity).toBe("critical");
  });

  it("attaches a real drill-down target with a genuine app route to insights that have one", () => {
    const insights = generateExecutiveInsights(baseContext());
    const revenue = insights.find((i) => i.id === "revenue");
    expect(revenue?.drillDown?.href).toBe("/finance/invoices");
  });

  it("omits drillDown (rather than fabricating one) when there's nothing to link to", () => {
    const insight = generateExecutiveInsights(baseContext()).find((i) => i.id === "risk");
    expect(insight?.drillDown).toBeNull();
  });
});
