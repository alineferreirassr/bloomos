"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getClients, getEvents, getContracts, getInvoices, getPayments, getExpenses } from "@/lib/data";
import { computeClientFinancialSummary } from "@/modules/finance/financialSummary";
import { clockNow } from "@/core/time/clock";
import type { Client } from "@/types/client";

const GENERIC_ACCESS_ERROR = "Client Intelligence isn't available. You may not have access to it.";
const INACTIVITY_DAYS = 365;

export interface ClientLifetimeRow {
  clientId: string;
  name: string;
  lifetimeCollectedMinor: number;
  eventCount: number;
  isReturning: boolean;
  isVip: boolean;
  isHighValue: boolean;
  isInactive: boolean;
}

export interface ClientIntelligenceData {
  totalClientCount: number;
  returningClientCount: number;
  oneTimeClientCount: number;
  vipClientCount: number;
  highValueClientCount: number;
  inactiveClientCount: number;
  /** Returning clients / all clients with at least one Event — the standard retention definition; `null` when no client has ever had an Event yet. */
  retentionRatePercent: number | null;
  /** Every client with its own real lifetime figures, sorted by lifetime value descending — the segments above are all derived from this same list, never recomputed separately. */
  clients: ClientLifetimeRow[];
}

export type GetClientIntelligenceDataResult = { success: true; data: ClientIntelligenceData } | { success: false; error: string };

/**
 * v2 Checkpoint 23, Step 5 — Client Intelligence. Every figure here is
 * derived from a client's own real Contracts/Invoices/Payments/Expenses via
 * `computeClientFinancialSummary` (Checkpoint 15) — never a fabricated
 * score. "VIP" and "High Value" are deliberately relative thresholds (above
 * the workspace's own average lifetime spend), not arbitrary fixed dollar
 * amounts, so they scale with the business rather than needing to be
 * retuned. See docs/executive-dashboard.md's Known Limitations for the
 * exact thresholds.
 */
export async function getClientIntelligenceData(): Promise<GetClientIntelligenceDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("clients.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const now = clockNow();
  const [clients, events, contracts, invoices, payments, expenses] = await Promise.all([
    getClients({ includeArchived: false }),
    getEvents({ includeArchived: true }),
    getContracts({ includeArchived: true }),
    getInvoices({ includeArchived: true }),
    getPayments(),
    getExpenses({ includeArchived: true }),
  ]);

  const eventsByClient = new Map<string, typeof events>();
  for (const event of events) {
    const list = eventsByClient.get(event.client_id) ?? [];
    list.push(event);
    eventsByClient.set(event.client_id, list);
  }
  const paymentsByClient = new Map<string, typeof payments>();
  for (const payment of payments) {
    const list = paymentsByClient.get(payment.client_id) ?? [];
    list.push(payment);
    paymentsByClient.set(payment.client_id, list);
  }

  const inactivityCutoff = new Date(now.getTime() - INACTIVITY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  // Only a client who was actually active at some point (at least one Event or Payment, ever) can go "inactive" — a brand-new client with zero activity yet is simply new, not dormant.
  const isInactive = (client: Client): boolean => {
    const clientEvents = eventsByClient.get(client.id) ?? [];
    const clientPayments = paymentsByClient.get(client.id) ?? [];
    if (clientEvents.length === 0 && clientPayments.length === 0) return false;
    const hasUpcomingOrRecentEvent = clientEvents.some((event) => event.event_date !== null && event.event_date >= inactivityCutoff.slice(0, 10));
    const hasRecentPayment = clientPayments.some((payment) => payment.transaction_date >= inactivityCutoff);
    return !hasUpcomingOrRecentEvent && !hasRecentPayment;
  };

  const lifetimeByClient = clients.map((client) => ({
    client,
    summary: computeClientFinancialSummary(client.id, contracts, invoices, payments, expenses),
    eventCount: (eventsByClient.get(client.id) ?? []).length,
  }));

  const payingClients = lifetimeByClient.filter((row) => row.summary.collected_minor > 0);
  const averageLifetimeMinor = payingClients.length === 0 ? 0 : payingClients.reduce((sum, row) => sum + row.summary.collected_minor, 0) / payingClients.length;

  const clientRows: ClientLifetimeRow[] = lifetimeByClient.map(({ client, summary, eventCount }) => {
    const highValue = averageLifetimeMinor > 0 && summary.collected_minor > averageLifetimeMinor;
    return {
      clientId: client.id,
      name: `${client.first_name} ${client.last_name}`.trim(),
      lifetimeCollectedMinor: summary.collected_minor,
      eventCount,
      isReturning: client.is_returning,
      isVip: client.is_returning && highValue,
      isHighValue: highValue,
      isInactive: isInactive(client),
    };
  });

  const clientsWithEvents = clientRows.filter((row) => row.eventCount > 0);
  const returningClientCount = clientRows.filter((row) => row.isReturning).length;
  const oneTimeClientCount = clientsWithEvents.filter((row) => !row.isReturning).length;

  return {
    success: true,
    data: {
      totalClientCount: clientRows.length,
      returningClientCount,
      oneTimeClientCount,
      vipClientCount: clientRows.filter((row) => row.isVip).length,
      highValueClientCount: clientRows.filter((row) => row.isHighValue).length,
      inactiveClientCount: clientRows.filter((row) => row.isInactive).length,
      retentionRatePercent: clientsWithEvents.length === 0 ? null : (returningClientCount / clientsWithEvents.length) * 100,
      clients: [...clientRows].sort((a, b) => b.lifetimeCollectedMinor - a.lifetimeCollectedMinor),
    },
  };
}
