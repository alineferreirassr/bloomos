import { formatMoney } from "@/lib/money";
import type { ExecutiveInsight } from "@/types/businessIntelligence";

/**
 * v2 Checkpoint 23, Step 12 — Bloom AI Executive Insights. Spec: "Everything
 * deterministic" — this is a plain template generator over already-computed
 * facts, the same discipline `generateExecutiveBrief.ts` (Checkpoint 20)
 * already established for the Owner Dashboard's brief, extended from one
 * flat list of lines into 7 named categories. Deliberately NOT the
 * LLM-backed `generateAnalyticsExecutiveSummary` (Checkpoint 15) — that
 * summarizer stays the one place in this codebase real Bloom AI model calls
 * happen for analytics; this engine never calls it and never should.
 */

export interface ExecutiveInsightsContext {
  revenue: { thisMonthMinor: number; lastMonthMinor: number; currency: string };
  expenses: { thisMonthMinor: number; lastMonthMinor: number; currency: string };
  pipeline: { openLeadCount: number; pipelineValueMinor: number; conversionRatePercent: number; currency: string };
  risk: { criticalRiskCount: number; overdueInvoiceCount: number; overdueInvoiceTotalMinor: number; currency: string };
  growth: { newClientsThisMonth: number; newClientsLastMonth: number };
  clientTrend: { vipClientCount: number; inactiveClientCount: number };
  operational: { lowStockItemCount: number; unassignedRequirementCount: number };
}

function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

export function generateExecutiveInsights(context: ExecutiveInsightsContext): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];

  const revenueChange = percentDelta(context.revenue.thisMonthMinor, context.revenue.lastMonthMinor);
  insights.push({
    id: "revenue",
    category: "revenue",
    severity: revenueChange !== null && revenueChange < 0 ? "warning" : "positive",
    title: revenueChange === null ? `${formatMoney(context.revenue.thisMonthMinor, context.revenue.currency)} in revenue this month` : `Revenue is ${revenueChange >= 0 ? "up" : "down"} ${Math.abs(Math.round(revenueChange))}% vs. last month`,
    detail: `${formatMoney(context.revenue.thisMonthMinor, context.revenue.currency)} recorded this month, vs. ${formatMoney(context.revenue.lastMonthMinor, context.revenue.currency)} last month.`,
    drillDown: { kind: "invoices", label: "View invoices", href: "/finance/invoices" },
  });

  const expenseChange = percentDelta(context.expenses.thisMonthMinor, context.expenses.lastMonthMinor);
  insights.push({
    id: "expense",
    category: "expense",
    severity: expenseChange !== null && expenseChange > 20 ? "warning" : "info",
    title: expenseChange === null ? `${formatMoney(context.expenses.thisMonthMinor, context.expenses.currency)} in expenses this month` : `Expenses are ${expenseChange >= 0 ? "up" : "down"} ${Math.abs(Math.round(expenseChange))}% vs. last month`,
    detail: `${formatMoney(context.expenses.thisMonthMinor, context.expenses.currency)} recorded this month, vs. ${formatMoney(context.expenses.lastMonthMinor, context.expenses.currency)} last month.`,
    drillDown: { kind: "expenses", label: "View expenses", href: "/finance/expenses" },
  });

  insights.push({
    id: "pipeline",
    category: "pipeline",
    severity: context.pipeline.conversionRatePercent < 15 ? "warning" : "info",
    title: `${context.pipeline.openLeadCount} open lead${context.pipeline.openLeadCount === 1 ? "" : "s"} worth ${formatMoney(context.pipeline.pipelineValueMinor, context.pipeline.currency)}`,
    detail: `Conversion rate is ${Math.round(context.pipeline.conversionRatePercent)}%.`,
    drillDown: { kind: "leads", label: "View pipeline", href: "/pipeline/commercial" },
  });

  insights.push({
    id: "risk",
    category: "risk",
    severity: context.risk.criticalRiskCount > 0 ? "critical" : context.risk.overdueInvoiceCount > 0 ? "warning" : "positive",
    title:
      context.risk.criticalRiskCount > 0
        ? `${context.risk.criticalRiskCount} critical operational risk${context.risk.criticalRiskCount === 1 ? "" : "s"} need attention`
        : context.risk.overdueInvoiceCount > 0
          ? `${context.risk.overdueInvoiceCount} overdue invoice${context.risk.overdueInvoiceCount === 1 ? "" : "s"}`
          : "No critical risks or overdue invoices",
    detail: context.risk.overdueInvoiceCount > 0 ? `${formatMoney(context.risk.overdueInvoiceTotalMinor, context.risk.currency)} in overdue receivables across ${context.risk.overdueInvoiceCount} invoice${context.risk.overdueInvoiceCount === 1 ? "" : "s"}.` : "Nothing overdue right now.",
    drillDown: context.risk.overdueInvoiceCount > 0 ? { kind: "invoices", label: "View overdue invoices", href: "/finance/invoices?status=overdue" } : null,
  });

  const growthChange = percentDelta(context.growth.newClientsThisMonth, context.growth.newClientsLastMonth);
  insights.push({
    id: "growth",
    category: "growth",
    severity: growthChange !== null && growthChange > 0 ? "positive" : "info",
    title: `${context.growth.newClientsThisMonth} new client${context.growth.newClientsThisMonth === 1 ? "" : "s"} this month`,
    detail: growthChange === null ? "No prior-month baseline to compare against yet." : `${growthChange >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(growthChange))}% vs. last month (${context.growth.newClientsLastMonth}).`,
    drillDown: { kind: "clients", label: "View clients", href: "/clients" },
  });

  insights.push({
    id: "client-trend",
    category: "clientTrend",
    severity: context.clientTrend.inactiveClientCount > context.clientTrend.vipClientCount ? "warning" : "info",
    title: `${context.clientTrend.vipClientCount} VIP client${context.clientTrend.vipClientCount === 1 ? "" : "s"}, ${context.clientTrend.inactiveClientCount} gone inactive`,
    detail: "VIP = repeat, high-value clients; inactive = no activity in the last 12 months.",
    drillDown: { kind: "clients", label: "View clients", href: "/clients" },
  });

  insights.push({
    id: "operational-bottleneck",
    category: "operationalBottleneck",
    severity: context.operational.lowStockItemCount > 0 || context.operational.unassignedRequirementCount > 0 ? "warning" : "positive",
    title:
      context.operational.lowStockItemCount === 0 && context.operational.unassignedRequirementCount === 0
        ? "No operational bottlenecks detected"
        : `${context.operational.lowStockItemCount} low-stock item${context.operational.lowStockItemCount === 1 ? "" : "s"}, ${context.operational.unassignedRequirementCount} unassigned requirement${context.operational.unassignedRequirementCount === 1 ? "" : "s"}`,
    detail: "Across active, upcoming events.",
    drillDown: context.operational.lowStockItemCount > 0 ? { kind: "purchases", label: "View purchases", href: "/purchases" } : null,
  });

  return insights;
}
