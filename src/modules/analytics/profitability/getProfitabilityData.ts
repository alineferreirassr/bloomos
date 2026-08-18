"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getEvents, getInvoices, listServices, listEventServicesByEvent } from "@/lib/data";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { resolveTrendWindow, filterInWindow } from "@/core/analytics/engine";
import { allocateAcrossEventServices } from "@/modules/analytics/serviceAllocation";
import type { TrendWindowKey } from "@/types/analytics";
import type { Payment } from "@/types/payment";

const GENERIC_ACCESS_ERROR = "The Profitability Center isn't available. You may not have access to it.";

export interface ServiceProfitability {
  serviceId: string;
  name: string;
  revenueMinor: number;
  costMinor: number;
  profitMinor: number;
  /** `null` when `revenueMinor` is 0 — no meaningful margin to report. */
  marginPercent: number | null;
}

export interface ProfitabilityData {
  grossProfitMinor: number;
  netProfitMinor: number;
  grossMarginPercent: number | null;
  netMarginPercent: number | null;
  /** Total event-scoped expenses (Expenses with a non-null `event_id`) divided by the number of distinct events that have at least one such expense — never diluted by events with no recorded cost. */
  costPerEventMinor: number;
  mostProfitableServices: ServiceProfitability[];
  leastProfitableServices: ServiceProfitability[];
}

export type GetProfitabilityDataResult = { success: true; data: ProfitabilityData } | { success: false; error: string };

function paymentCounts(payment: Payment): boolean {
  return PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status) && payment.payment_type !== "refund";
}

/**
 * v2 Checkpoint 23, Step 3 — Profitability Center. Gross/Net Profit and
 * margins reuse the exact same cash-basis/accrual-basis distinction
 * `financialSummary.ts` already established (gross = revenue-basis, net =
 * cash-basis); per-service figures reuse `allocateAcrossEventServices` —
 * the same proportional allocation Revenue Analytics (Step 2) uses, so
 * "Most/Least Profitable Services" agrees with "Revenue by Service" on
 * what each service actually earned.
 *
 * Phase 08 — every field this action returns is Gross/Net Profit, margin, or
 * per-service profit, i.e. exactly what `finance.executive.view` exists to
 * gate under the frozen Phase 06B policy (this tab was previously gated on
 * `analytics.view` alone). Since the entire payload is profit-shaped, this
 * requires the permission outright rather than redacting individual fields
 * — matching the same full-gate precedent `getFinanceLedgerSummaryAction`
 * already uses for `finance.accounting.view`, and simpler/lower-risk than
 * partial nulling for a table-heavy view where nearly every column is money.
 */
export async function getProfitabilityData(windowKey: TrendWindowKey): Promise<GetProfitabilityDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view") || !session.permissions.includes("finance.view") || !session.permissions.includes("finance.executive.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const { window } = resolveTrendWindow(windowKey);
  const [allPayments, allInvoices, allExpenses, events, services] = await Promise.all([
    getPayments(),
    getInvoices({ includeArchived: true }),
    getExpenses({ includeArchived: true }),
    getEvents({ includeArchived: true }),
    listServices({ includeArchived: true }),
  ]);

  const payments = filterInWindow(allPayments.filter(paymentCounts), (p) => p.transaction_date, window);
  const invoices = filterInWindow(
    allInvoices.filter((i) => i.status !== "voided" && i.issue_date !== null),
    (i) => i.issue_date as string,
    window,
  );
  const expenses = filterInWindow(
    allExpenses.filter((e) => e.status !== "cancelled"),
    (e) => e.transaction_date,
    window,
  );

  const collectedRevenueMinor = payments.reduce((sum, p) => sum + p.amount_minor, 0);
  const invoicedRevenueMinor = invoices.reduce((sum, i) => sum + i.total_minor, 0);
  const costMinor = expenses.reduce((sum, e) => sum + e.amount_minor, 0);
  // Gross = accrual-basis (what's been billed, regardless of collection); Net = cash-basis (what's actually been collected) — the same distinction `financialSummary.ts`'s own computeWorkspaceFinancialSummary already establishes.
  const grossProfitMinor = invoicedRevenueMinor - costMinor;
  const netProfitMinor = collectedRevenueMinor - costMinor;
  const grossMarginPercent = invoicedRevenueMinor === 0 ? null : (grossProfitMinor / invoicedRevenueMinor) * 100;
  const netMarginPercent = collectedRevenueMinor === 0 ? null : (netProfitMinor / collectedRevenueMinor) * 100;

  const eventScopedExpenses = expenses.filter((e) => e.event_id !== null);
  const eventIdsWithCost = new Set(eventScopedExpenses.map((e) => e.event_id));
  const costPerEventMinor = eventIdsWithCost.size === 0 ? 0 : Math.round(eventScopedExpenses.reduce((sum, e) => sum + e.amount_minor, 0) / eventIdsWithCost.size);

  // Per-service revenue/cost allocation, same method as Revenue Analytics' "service" dimension.
  const eventById = new Map(events.map((e) => [e.id, e]));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const eventIds = [...new Set([...payments.map((p) => p.event_id), ...expenses.map((e) => e.event_id)].filter((id): id is string => id !== null))];
  const eventServiceLists = await Promise.all(eventIds.map((id) => listEventServicesByEvent(id)));
  const eventServicesByEventId = new Map(eventIds.map((id, index) => [id, eventServiceLists[index]]));

  const revenueByService = new Map<string, number>();
  const costByService = new Map<string, number>();
  const nameByService = new Map<string, string>();

  for (const payment of payments) {
    if (!payment.event_id || !eventById.has(payment.event_id)) continue;
    const eventServices = eventServicesByEventId.get(payment.event_id) ?? [];
    allocateAcrossEventServices(payment.amount_minor, eventServices, (serviceId, share) => {
      revenueByService.set(serviceId, (revenueByService.get(serviceId) ?? 0) + share);
      if (!nameByService.has(serviceId)) nameByService.set(serviceId, serviceById.get(serviceId)?.name ?? eventServices.find((es) => es.service_id === serviceId)?.name ?? serviceId);
    });
  }
  for (const expense of expenses) {
    if (!expense.event_id || !eventById.has(expense.event_id)) continue;
    const eventServices = eventServicesByEventId.get(expense.event_id) ?? [];
    allocateAcrossEventServices(expense.amount_minor, eventServices, (serviceId, share) => {
      costByService.set(serviceId, (costByService.get(serviceId) ?? 0) + share);
      if (!nameByService.has(serviceId)) nameByService.set(serviceId, serviceById.get(serviceId)?.name ?? eventServices.find((es) => es.service_id === serviceId)?.name ?? serviceId);
    });
  }

  const serviceIds = new Set([...revenueByService.keys(), ...costByService.keys()]);
  const serviceProfitability: ServiceProfitability[] = [...serviceIds].map((serviceId) => {
    const serviceRevenueMinor = revenueByService.get(serviceId) ?? 0;
    const serviceCostMinor = costByService.get(serviceId) ?? 0;
    const profitMinor = serviceRevenueMinor - serviceCostMinor;
    return {
      serviceId,
      name: nameByService.get(serviceId) ?? serviceId,
      revenueMinor: serviceRevenueMinor,
      costMinor: serviceCostMinor,
      profitMinor,
      marginPercent: serviceRevenueMinor === 0 ? null : (profitMinor / serviceRevenueMinor) * 100,
    };
  });

  const byProfitDesc = [...serviceProfitability].sort((a, b) => b.profitMinor - a.profitMinor);

  return {
    success: true,
    data: {
      grossProfitMinor,
      netProfitMinor,
      grossMarginPercent,
      netMarginPercent,
      costPerEventMinor,
      mostProfitableServices: byProfitDesc.slice(0, 5),
      leastProfitableServices: byProfitDesc.slice(-5).reverse(),
    },
  };
}
