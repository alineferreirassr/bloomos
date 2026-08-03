"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getInvoices, getLeads, getClients } from "@/lib/data";
import { getOperationsDashboardData } from "@/modules/operations/operationsDashboardData";
import { getClientIntelligenceData } from "@/modules/analytics/clientIntelligence/getClientIntelligenceData";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { filterInWindow } from "@/core/analytics/engine";
import { resolveBenchmarkWindow } from "@/core/analytics/benchmarkEngine";
import { generateExecutiveInsights } from "@/core/analytics/executiveInsightsEngine";
import { majorToMinor } from "@/lib/money";
import { clockNow } from "@/core/time/clock";
import { columnPipelineValue } from "@/modules/pipeline/logic";
import type { ExecutiveInsight } from "@/types/businessIntelligence";
import type { Payment } from "@/types/payment";

const GENERIC_ACCESS_ERROR = "Bloom AI Executive Insights isn't available. You may not have access to it.";
const OPEN_LEAD_STATUSES = new Set(["new", "contacted", "welcome_guide_sent", "consultation_scheduled", "qualified", "proposal_sent", "waiting_decision"]);

export type GetExecutiveInsightsDataResult = { success: true; data: ExecutiveInsight[] } | { success: false; error: string };

function paymentCounts(payment: Payment): boolean {
  return PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status) && payment.payment_type !== "refund";
}

/** v2 Checkpoint 23, Step 12 — Bloom AI Executive Insights. Deterministic (`ExecutiveInsightsEngine`, Step 16's own core engine) — assembles real facts, reusing `getClientIntelligenceData` (Step 5) and `getOperationsDashboardData` (Checkpoint 21) directly rather than recomputing VIP/inactive-client or event-health logic a second time. */
export async function getExecutiveInsightsData(): Promise<GetExecutiveInsightsDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const now = clockNow();
  const thisMonthWindow = resolveBenchmarkWindow("thisMonth", now);
  const lastMonthWindow = resolveBenchmarkWindow("lastMonth", now);

  const [payments, expenses, invoices, leads, clients, operationsData, clientIntelligence] = await Promise.all([
    getPayments(),
    getExpenses({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getLeads({ includeArchived: false }),
    getClients({ includeArchived: false }),
    getOperationsDashboardData(),
    getClientIntelligenceData(),
  ]);

  const succeedingPayments = payments.filter(paymentCounts);
  const revenueThisMonth = filterInWindow(succeedingPayments, (p) => p.transaction_date, thisMonthWindow).reduce((sum, p) => sum + p.amount_minor, 0);
  const revenueLastMonth = filterInWindow(succeedingPayments, (p) => p.transaction_date, lastMonthWindow).reduce((sum, p) => sum + p.amount_minor, 0);

  const activeExpenses = expenses.filter((e) => e.status !== "cancelled");
  const expensesThisMonth = filterInWindow(activeExpenses, (e) => e.transaction_date, thisMonthWindow).reduce((sum, e) => sum + e.amount_minor, 0);
  const expensesLastMonth = filterInWindow(activeExpenses, (e) => e.transaction_date, lastMonthWindow).reduce((sum, e) => sum + e.amount_minor, 0);

  const openLeads = leads.filter((lead) => OPEN_LEAD_STATUSES.has(lead.status));
  const conversionRatePercent = leads.length === 0 ? 0 : (leads.filter((l) => l.converted_client_id !== null).length / leads.length) * 100;

  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const criticalRiskCount = operationsData.eventHealthScores.filter((e) => e.score < 45).length;

  const newClientsThisMonth = filterInWindow(clients, (c) => c.created_at, thisMonthWindow).length;
  const newClientsLastMonth = filterInWindow(clients, (c) => c.created_at, lastMonthWindow).length;

  const currency = payments[0]?.currency ?? "usd";
  const vipClientCount = clientIntelligence.success ? clientIntelligence.data.vipClientCount : 0;
  const inactiveClientCount = clientIntelligence.success ? clientIntelligence.data.inactiveClientCount : 0;

  const insights = generateExecutiveInsights({
    revenue: { thisMonthMinor: revenueThisMonth, lastMonthMinor: revenueLastMonth, currency },
    expenses: { thisMonthMinor: expensesThisMonth, lastMonthMinor: expensesLastMonth, currency },
    pipeline: { openLeadCount: openLeads.length, pipelineValueMinor: majorToMinor(columnPipelineValue(openLeads)), conversionRatePercent, currency },
    risk: { criticalRiskCount, overdueInvoiceCount: overdueInvoices.length, overdueInvoiceTotalMinor: overdueInvoices.reduce((sum, i) => sum + i.balance_minor, 0), currency },
    growth: { newClientsThisMonth, newClientsLastMonth },
    clientTrend: { vipClientCount, inactiveClientCount },
    operational: { lowStockItemCount: operationsData.lowStockItems.length, unassignedRequirementCount: operationsData.unconfirmedVendorAssignmentCount },
  });

  return { success: true, data: insights };
}
