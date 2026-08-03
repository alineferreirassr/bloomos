import { clockNow } from "@/core/time/clock";
import { businessHealthBandFromScore, type BusinessHealthDimensionScore, type BusinessHealthFactor, type BusinessHealthResult } from "@/types/businessIntelligence";

/**
 * v2 Checkpoint 23, Step 10 — Business Health Score. A workspace-wide
 * unification of Checkpoint 21's per-event `OperationsHealthDetails`
 * (reused here as the `operations` dimension's own input, never
 * recomputed) plus eight further dimensions. Same "deduction-based 0-100,
 * pure function over pre-aggregated facts" shape `healthScoreEngine.ts`
 * already established — this engine never fetches data itself, the module
 * layer (`businessHealthData.ts`) does the fetching/aggregation and hands
 * in already-computed ratios/counts.
 *
 * Weights sum to 1.0 and represent each dimension's normal share of the
 * total; `customerSatisfaction` always scores `null` (see its own
 * explanation below) and its weight is proportionally redistributed among
 * the dimensions that do have real data, rather than counted as a
 * fabricated 0 or silently dropped.
 */

const WEIGHTS = {
  finance: 0.18,
  crm: 0.11,
  operations: 0.13,
  inventory: 0.08,
  team: 0.09,
  events: 0.12,
  payments: 0.11,
  customerSatisfaction: 0.08,
  risk: 0.1,
} as const;

export interface BusinessHealthContext {
  finance: { overdueReceivablesRatio: number; hasRevenueThisPeriod: boolean; netProfitMarginPercent: number; cashFlowNegative: boolean };
  crm: { conversionRatePercent: number; conversionTrendDown: boolean; leadCount: number };
  operations: { averageEventHealthScore: number | null; lateTaskCount: number };
  inventory: { lowStockItemCount: number; totalItemCount: number };
  team: { overdueTaskCount: number; totalTaskCount: number };
  events: { atRiskEventCount: number; totalActiveEventCount: number };
  payments: { failedPaymentCount: number; overduePaymentCount: number };
  risk: { openCriticalRiskCount: number; openWarningRiskCount: number };
}

function score(factors: BusinessHealthFactor[]): number {
  const totalDeduction = factors.reduce((sum, factor) => sum + Math.max(0, -factor.impact), 0);
  return Math.max(0, Math.min(100, 100 - totalDeduction));
}

/**
 * Every dimension below deducts continuously (proportional to how bad the
 * underlying ratio/count actually is) rather than a small number of
 * capped tiers — a genuinely catastrophic workspace (every receivable
 * overdue, every event at risk, multiple critical risks open) must be able
 * to reach the `critical` band, not plateau partway there. Deductions are
 * still floored per-dimension at 0 (never negative) by `score()`.
 */

function financeDimension(ctx: BusinessHealthContext["finance"]): BusinessHealthDimensionScore {
  const factors: BusinessHealthFactor[] = [];
  const receivablesDeduction = Math.round(ctx.overdueReceivablesRatio * 50);
  if (receivablesDeduction > 0) factors.push({ label: `${Math.round(ctx.overdueReceivablesRatio * 100)}% of receivables are overdue`, impact: -receivablesDeduction });
  // No revenue this period is "no data yet," not "0% margin" — same treatment as the crm dimension's zero-lead case.
  if (ctx.hasRevenueThisPeriod && ctx.netProfitMarginPercent < 10) {
    const marginDeduction = ctx.netProfitMarginPercent < 0 ? Math.min(50, Math.round(-ctx.netProfitMarginPercent)) : 10;
    factors.push({ label: ctx.netProfitMarginPercent < 0 ? "Operating at a net loss this period" : "Net margin is thin (under 10%)", impact: -marginDeduction });
  }
  if (ctx.cashFlowNegative) factors.push({ label: "Cash flow is negative this period", impact: -20 });
  return { dimension: "finance", score: score(factors), weight: WEIGHTS.finance, explanation: "Revenue collected vs. outstanding, net profit margin, and cash flow direction this period.", factors };
}

function crmDimension(ctx: BusinessHealthContext["crm"]): BusinessHealthDimensionScore {
  const factors: BusinessHealthFactor[] = [];
  // No leads at all is "no data yet," not "0% conversion" — never penalize a workspace for a pipeline that simply hasn't started (same "don't fabricate a deduction from an absent population" logic inventory/team/events already apply via their own ratios).
  if (ctx.leadCount > 0) {
    const shortfall = Math.max(0, 40 - ctx.conversionRatePercent);
    const conversionDeduction = Math.round(shortfall * 1.5);
    if (conversionDeduction > 0) factors.push({ label: `Lead-to-client conversion is ${Math.round(ctx.conversionRatePercent)}%`, impact: -conversionDeduction });
    if (ctx.conversionTrendDown) factors.push({ label: "Conversion rate is trending down", impact: -15 });
  }
  return { dimension: "crm", score: score(factors), weight: WEIGHTS.crm, explanation: "Lead-to-client conversion rate and its recent trend.", factors };
}

function operationsDimension(ctx: BusinessHealthContext["operations"]): BusinessHealthDimensionScore {
  const factors: BusinessHealthFactor[] = [];
  if (ctx.averageEventHealthScore !== null && ctx.averageEventHealthScore < 100) {
    factors.push({ label: "Average event health score is below 100", impact: -Math.round((100 - ctx.averageEventHealthScore) * 0.8) });
  }
  if (ctx.lateTaskCount > 0) factors.push({ label: `${ctx.lateTaskCount} overdue checklist item${ctx.lateTaskCount === 1 ? "" : "s"} across active events`, impact: -Math.min(30, ctx.lateTaskCount * 5) });
  return { dimension: "operations", score: score(factors), weight: WEIGHTS.operations, explanation: "Average per-event health score (Checkpoint 21's Event Health Score v2) across active events, plus overdue checklist items.", factors };
}

function inventoryDimension(ctx: BusinessHealthContext["inventory"]): BusinessHealthDimensionScore {
  const factors: BusinessHealthFactor[] = [];
  const ratio = ctx.totalItemCount > 0 ? ctx.lowStockItemCount / ctx.totalItemCount : 0;
  const deduction = Math.round(ratio * 100);
  if (deduction > 0) factors.push({ label: `${Math.round(ratio * 100)}% of inventory is low in stock`, impact: -deduction });
  return { dimension: "inventory", score: score(factors), weight: WEIGHTS.inventory, explanation: "Share of inventory items currently low in stock.", factors };
}

function teamDimension(ctx: BusinessHealthContext["team"]): BusinessHealthDimensionScore {
  const factors: BusinessHealthFactor[] = [];
  const ratio = ctx.totalTaskCount > 0 ? ctx.overdueTaskCount / ctx.totalTaskCount : 0;
  const deduction = Math.round(ratio * 100);
  if (deduction > 0) factors.push({ label: `${Math.round(ratio * 100)}% of assigned tasks are overdue`, impact: -deduction });
  return { dimension: "team", score: score(factors), weight: WEIGHTS.team, explanation: "Share of team-assigned checklist items currently overdue.", factors };
}

function eventsDimension(ctx: BusinessHealthContext["events"]): BusinessHealthDimensionScore {
  const factors: BusinessHealthFactor[] = [];
  const ratio = ctx.totalActiveEventCount > 0 ? ctx.atRiskEventCount / ctx.totalActiveEventCount : 0;
  const deduction = Math.round(ratio * 100);
  if (deduction > 0) factors.push({ label: `${Math.round(ratio * 100)}% of active events are at Attention/Critical health`, impact: -deduction });
  return { dimension: "events", score: score(factors), weight: WEIGHTS.events, explanation: "Share of active events currently at Attention or Critical health band.", factors };
}

function paymentsDimension(ctx: BusinessHealthContext["payments"]): BusinessHealthDimensionScore {
  const factors: BusinessHealthFactor[] = [];
  if (ctx.failedPaymentCount > 0) factors.push({ label: `${ctx.failedPaymentCount} failed payment${ctx.failedPaymentCount === 1 ? "" : "s"}`, impact: -Math.min(60, ctx.failedPaymentCount * 10) });
  if (ctx.overduePaymentCount > 0) factors.push({ label: `${ctx.overduePaymentCount} overdue invoice${ctx.overduePaymentCount === 1 ? "" : "s"}`, impact: -Math.min(60, ctx.overduePaymentCount * 8) });
  return { dimension: "payments", score: score(factors), weight: WEIGHTS.payments, explanation: "Failed payments and overdue invoices across the workspace.", factors };
}

function customerSatisfactionDimension(): BusinessHealthDimensionScore {
  return {
    dimension: "customerSatisfaction",
    score: null,
    weight: WEIGHTS.customerSatisfaction,
    explanation: "No customer satisfaction data source exists in BloomOS yet (no review/CSAT capture) — excluded from the score rather than approximated. Its normal weight is redistributed across the other dimensions.",
    factors: [],
  };
}

function riskDimension(ctx: BusinessHealthContext["risk"]): BusinessHealthDimensionScore {
  const factors: BusinessHealthFactor[] = [];
  if (ctx.openCriticalRiskCount > 0) factors.push({ label: `${ctx.openCriticalRiskCount} open critical risk${ctx.openCriticalRiskCount === 1 ? "" : "s"}`, impact: -Math.min(70, ctx.openCriticalRiskCount * 25) });
  if (ctx.openWarningRiskCount > 0) factors.push({ label: `${ctx.openWarningRiskCount} open warning risk${ctx.openWarningRiskCount === 1 ? "" : "s"}`, impact: -Math.min(30, ctx.openWarningRiskCount * 6) });
  return { dimension: "risk", score: score(factors), weight: WEIGHTS.risk, explanation: "Open risks from Checkpoint 21's Risk Center across active events.", factors };
}

export function computeBusinessHealthScore(context: BusinessHealthContext, now: Date = clockNow()): BusinessHealthResult {
  const dimensions: BusinessHealthDimensionScore[] = [
    financeDimension(context.finance),
    crmDimension(context.crm),
    operationsDimension(context.operations),
    inventoryDimension(context.inventory),
    teamDimension(context.team),
    eventsDimension(context.events),
    paymentsDimension(context.payments),
    customerSatisfactionDimension(),
    riskDimension(context.risk),
  ];

  const scored = dimensions.filter((d): d is BusinessHealthDimensionScore & { score: number } => d.score !== null);
  const totalWeight = scored.reduce((sum, d) => sum + d.weight, 0);
  const weightedScore = totalWeight === 0 ? 100 : scored.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight;
  const finalScore = Math.round(weightedScore);

  return { score: finalScore, band: businessHealthBandFromScore(finalScore), dimensions, computedAt: now.toISOString() };
}
