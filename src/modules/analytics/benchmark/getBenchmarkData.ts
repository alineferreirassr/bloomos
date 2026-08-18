"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getEvents, getClients } from "@/lib/data";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { filterInWindow } from "@/core/analytics/engine";
import { computeBenchmark } from "@/core/analytics/benchmarkEngine";
import { clockNow } from "@/core/time/clock";
import type { BenchmarkResult } from "@/types/businessIntelligence";
import type { TimeWindow } from "@/types/analytics";
import type { Payment } from "@/types/payment";
import type { Expense } from "@/types/expense";

const GENERIC_ACCESS_ERROR = "The Benchmark Center isn't available. You may not have access to it.";

export interface BenchmarkData {
  /** `null` when the caller lacks `finance.amounts.view` — Phase 08's redaction, matching the Phase 06B policy applied elsewhere in Finance. */
  revenue: BenchmarkResult | null;
  /** `null` when the caller lacks `finance.executive.view` — Profit is gated separately from raw revenue amounts, per the same policy. */
  profit: BenchmarkResult | null;
  eventsBooked: BenchmarkResult;
  newClients: BenchmarkResult;
}

export type GetBenchmarkDataResult = { success: true; data: BenchmarkData } | { success: false; error: string };

function paymentCounts(payment: Payment): boolean {
  return PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status) && payment.payment_type !== "refund";
}

function sumRevenueInWindow(payments: Payment[], window: TimeWindow): number {
  return filterInWindow(payments, (p) => p.transaction_date, window).reduce((sum, p) => sum + p.amount_minor, 0);
}

function sumExpensesInWindow(expenses: Expense[], window: TimeWindow): number {
  return filterInWindow(expenses, (e) => e.transaction_date, window).reduce((sum, e) => sum + e.amount_minor, 0);
}

/** v2 Checkpoint 23, Step 11 — Benchmark Center. Reuses `BenchmarkEngine` (Step 16's own core engine) for the period math; every metric here is a plain sum/count over already-fetched real data, matching how every other analytics module in this checkpoint computes its own figures. */
export async function getBenchmarkData(): Promise<GetBenchmarkDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const canViewAmounts = session.permissions.includes("finance.amounts.view");
  const canViewExecutive = session.permissions.includes("finance.executive.view");

  const now = clockNow();
  const [payments, expenses, events, clients] = await Promise.all([
    getPayments(),
    getExpenses({ includeArchived: true }),
    getEvents({ includeArchived: true }),
    getClients({ includeArchived: false }),
  ]);

  const succeedingPayments = payments.filter(paymentCounts);
  const activeExpenses = expenses.filter((e) => e.status !== "cancelled");
  const datedEvents = events.filter((e) => e.event_date !== null && e.status !== "cancelled" && e.status !== "archived");

  const [revenue, profit, eventsBooked, newClients] = await Promise.all([
    computeBenchmark("Revenue", (window) => sumRevenueInWindow(succeedingPayments, window), now),
    computeBenchmark("Profit", (window) => sumRevenueInWindow(succeedingPayments, window) - sumExpensesInWindow(activeExpenses, window), now),
    computeBenchmark("Events Booked", (window) => filterInWindow(datedEvents, (e) => e.event_date as string, window).length, now),
    computeBenchmark("New Clients", (window) => filterInWindow(clients, (c) => c.created_at, window).length, now),
  ]);

  return {
    success: true,
    data: {
      revenue: canViewAmounts ? revenue : null,
      profit: canViewExecutive ? profit : null,
      eventsBooked,
      newClients,
    },
  };
}
