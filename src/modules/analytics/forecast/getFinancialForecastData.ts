"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getEvents, listInventoryItems, listEventServicesByEvent, listEventServiceInventoryRequirements } from "@/lib/data";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { groupByMonth } from "@/core/analytics/engine";
import { forecastLinearRegression } from "@/core/analytics/forecastEngine";
import { clockNow } from "@/core/time/clock";
import type { ForecastResult } from "@/types/businessIntelligence";
import type { Payment } from "@/types/payment";

const GENERIC_ACCESS_ERROR = "The Financial Forecast isn't available. You may not have access to it.";
const LOOKBACK_MONTHS = 6;
const FORECAST_MONTHS_AHEAD = 3;
const UPCOMING_WINDOW_DAYS = 90;
const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export interface BusyMonthPrediction {
  month: string;
  historicalEventCount: number;
}

export interface InventoryNeedRow {
  itemId: string;
  itemName: string;
  quantityAvailable: number;
  reorderLevel: number;
  neededForUpcomingEvents: number;
}

export interface FinancialForecastData {
  /** `null` when the caller lacks `finance.amounts.view` — Phase 08's redaction, matching the Phase 06B policy applied elsewhere in Finance. */
  revenueForecast: ForecastResult | null;
  expenseForecast: ForecastResult | null;
  /** Projected revenue minus projected expenses per future month — derived from the two forecasts above, not a separately fitted model. `null` when the caller lacks `finance.executive.view` — it's a net/cash-flow figure, gated the same way `cashFlowMinor` is on the Executive tab. */
  cashFlowForecast: { month: string; projectedMinor: number }[] | null;
  /** The 3 calendar months with the most events historically, as a seasonal repeat-pattern prediction — not a fitted trend. */
  predictedBusyMonths: BusyMonthPrediction[];
  /** Inventory items already low in stock (`quantity_available <= reorder_level`) with a real, currently unfulfilled requirement from an event in the next 90 days — not a fabricated consumption-rate projection. */
  inventoryNeeds: InventoryNeedRow[];
}

export type GetFinancialForecastDataResult = { success: true; data: FinancialForecastData } | { success: false; error: string };

function paymentCounts(payment: Payment): boolean {
  return PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status) && payment.payment_type !== "refund";
}

/** v2 Checkpoint 23, Step 8 — Financial Forecast. Deterministic only (no external AI) — reuses `ForecastEngine` (Step 16's own core engine) for Revenue/Expenses, derives Cash Flow from those two, and predicts Busy Months/Inventory Needs from real historical/reservation data rather than a fitted curve. */
export async function getFinancialForecastData(): Promise<GetFinancialForecastDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const canViewAmounts = session.permissions.includes("finance.amounts.view");
  const canViewExecutive = session.permissions.includes("finance.executive.view");

  const now = clockNow();
  const [payments, expenses, events, inventoryItems] = await Promise.all([
    getPayments(),
    getExpenses({ includeArchived: true }),
    getEvents({ includeArchived: true }),
    listInventoryItems(),
  ]);

  const lookbackWindow = { start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - LOOKBACK_MONTHS, 1)).toISOString(), end: now.toISOString() };
  const revenueSeries = groupByMonth(payments.filter(paymentCounts), (p) => p.transaction_date, (p) => p.amount_minor, lookbackWindow);
  const expenseSeries = groupByMonth(
    expenses.filter((e) => e.status !== "cancelled"),
    (e) => e.transaction_date,
    (e) => e.amount_minor,
    lookbackWindow,
  );

  const revenueForecast = forecastLinearRegression(revenueSeries, FORECAST_MONTHS_AHEAD);
  const expenseForecast = forecastLinearRegression(expenseSeries, FORECAST_MONTHS_AHEAD);

  const expenseByLabel = new Map(expenseForecast.projected.map((p) => [p.label, p.value]));
  const cashFlowForecast = revenueForecast.projected.map((p) => ({ month: p.label, projectedMinor: p.value - (expenseByLabel.get(p.label) ?? 0) }));

  const monthCounts = new Array(12).fill(0) as number[];
  for (const event of events) {
    if (!event.event_date || event.status === "cancelled" || event.status === "archived") continue;
    monthCounts[new Date(event.event_date).getUTCMonth()] += 1;
  }
  const predictedBusyMonths: BusyMonthPrediction[] = monthCounts
    .map((count, index) => ({ month: MONTH_LABELS[index], historicalEventCount: count }))
    .sort((a, b) => b.historicalEventCount - a.historicalEventCount)
    .slice(0, 3)
    .filter((m) => m.historicalEventCount > 0);

  const upcomingCutoff = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const nowDate = now.toISOString().slice(0, 10);
  const upcomingEvents = events.filter((e) => e.event_date !== null && e.event_date >= nowDate && e.event_date <= upcomingCutoff && e.status !== "cancelled" && e.status !== "archived");
  const eventServiceLists = await Promise.all(upcomingEvents.map((e) => listEventServicesByEvent(e.id)));
  const allEventServices = eventServiceLists.flat();
  const requirementLists = await Promise.all(allEventServices.map((es) => listEventServiceInventoryRequirements(es.id)));
  const neededQuantityByItemId = new Map<string, number>();
  for (const requirements of requirementLists) {
    for (const requirement of requirements) {
      if (requirement.is_fulfilled || requirement.inventory_item_id === null) continue;
      neededQuantityByItemId.set(requirement.inventory_item_id, (neededQuantityByItemId.get(requirement.inventory_item_id) ?? 0) + requirement.quantity);
    }
  }

  const inventoryNeeds: InventoryNeedRow[] = inventoryItems
    .filter((item) => item.reorder_level !== null && item.quantity_available <= item.reorder_level && neededQuantityByItemId.has(item.id))
    .map((item) => ({
      itemId: item.id,
      itemName: item.name,
      quantityAvailable: item.quantity_available,
      reorderLevel: item.reorder_level as number,
      neededForUpcomingEvents: neededQuantityByItemId.get(item.id) as number,
    }))
    .sort((a, b) => b.neededForUpcomingEvents - a.neededForUpcomingEvents);

  return {
    success: true,
    data: {
      revenueForecast: canViewAmounts ? revenueForecast : null,
      expenseForecast: canViewAmounts ? expenseForecast : null,
      cashFlowForecast: canViewExecutive ? cashFlowForecast : null,
      predictedBusyMonths,
      inventoryNeeds,
    },
  };
}
