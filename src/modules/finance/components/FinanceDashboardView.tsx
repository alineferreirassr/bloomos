"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClients } from "@/lib/data";
import {
  getFinanceDashboardDataAction,
  getFinanceLedgerSummaryAction,
  getFinancialReconciliationDiagnosticAction,
  type FinanceDashboardViewData,
  type FinanceLedgerSummaryData,
  type FinancialReconciliationDiagnosticView,
} from "@/modules/finance/financeActions";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { PaymentForecastCard } from "@/modules/ai/copilot/assistants/PaymentForecastCard";
import type { Client } from "@/types/client";
import { getFullName } from "@/lib/personName";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { SectionHeader } from "@/modules/dashboard/luxury/components/SectionHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { formatMoney } from "@/lib/money";
import { formatEventDate } from "@/modules/events/dateFormat";
import { InvoiceStatusBadge } from "@/modules/finance/components/InvoiceStatusBadge";
import { PaymentStatusBadge } from "@/modules/finance/components/PaymentStatusBadge";
import { ExpenseStatusBadge } from "@/modules/finance/components/ExpenseStatusBadge";
import { EventFinancialStatusBadge } from "@/modules/finance/components/EventFinancialStatusBadge";
import { PostingStatusBadge } from "@/modules/finance/components/PostingStatusBadge";
import { FinanceLedgerNav } from "@/modules/finance/components/FinanceLedgerNav";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: FinanceDashboardViewData; clientsById: Map<string, Client> };

async function loadDashboard(): Promise<LoadState> {
  try {
    const [result, clients] = await Promise.all([getFinanceDashboardDataAction(), getClients({ includeArchived: true })]);
    if (!result.success) return { status: "error" };
    return { status: "ready", data: result.data, clientsById: new Map(clients.map((c) => [c.id, c])) };
  } catch {
    return { status: "error" };
  }
}

/**
 * Ledger summary — loaded and rendered independently of the Invoice/
 * Payment/Expense dashboard above (a Ledger fetch failure never blanks the
 * existing dashboard, and vice versa). Every figure here comes straight off
 * a list already returned by the committed Finance Repository — active
 * account count from listChartOfAccounts, period counts and the current
 * open period from listAccountingPeriods, latest entries from
 * listJournalEntries — none of it is aggregated or computed from unrelated
 * rows. No total assets/liabilities/revenue/profit/AR/AP figure exists
 * here; that requires a Reports phase this one deliberately excludes.
 */
type LedgerSummaryState =
  | { status: "loading" }
  | { status: "error" }
  /** The caller lacks `finance.accounting.view` — an expected permission boundary, not a fetch failure, so the whole section is omitted rather than shown as an error. */
  | { status: "no-access" }
  | ({ status: "ready" } & FinanceLedgerSummaryData);

async function loadLedgerSummary(): Promise<LedgerSummaryState> {
  try {
    const result = await getFinanceLedgerSummaryAction();
    if (!result.success) return { status: "no-access" };
    return { status: "ready", ...result.data };
  } catch {
    return { status: "error" };
  }
}

/**
 * Finance F1.5 — the Founder-only reconciliation diagnostic. Same
 * loaded-independently, no-access-is-not-an-error shape as the Ledger
 * summary above (a fetch failure or a permission boundary here never
 * blanks the rest of the Finance Dashboard). Read-only — this block never
 * triggers any mutation; it only calls
 * getFinancialReconciliationDiagnosticAction(), which itself only reads.
 */
type ReconciliationDiagnosticState =
  | { status: "loading" }
  | { status: "error" }
  /** The caller lacks `finance.executive.view` — omit the block, same convention as the Ledger summary's "no-access". */
  | { status: "no-access" }
  | ({ status: "ready" } & FinancialReconciliationDiagnosticView);

async function loadReconciliationDiagnostic(): Promise<ReconciliationDiagnosticState> {
  try {
    const result = await getFinancialReconciliationDiagnosticAction();
    if (!result.success) return { status: "no-access" };
    return { status: "ready", ...result.data };
  } catch {
    return { status: "error" };
  }
}

function clientName(clientsById: Map<string, Client>, clientId: string | null): string {
  if (!clientId) return "—";
  const client = clientsById.get(clientId);
  return client ? getFullName(client) : "—";
}

/**
 * The dashboard never computes a figure itself — every metric, list, and
 * alert comes straight out of getFinanceDashboardData() (lib/data/index.ts),
 * which in turn only calls the centralized financial-summary helpers
 * (computeWorkspaceFinancialSummary/computeAllTimeFinancialTotals/
 * computeEventFinancialSummary/deriveEventFinancialStatus). This view is
 * purely presentational.
 */
export function FinanceDashboardView() {
  const { can } = useMemberSession();
  const canCreate = can("finance.create");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [ledgerState, setLedgerState] = useState<LedgerSummaryState>({ status: "loading" });
  const [reconciliationState, setReconciliationState] = useState<ReconciliationDiagnosticState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadDashboard().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadLedgerSummary().then((next) => {
      if (!cancelled) setLedgerState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadReconciliationDiagnostic().then((next) => {
      if (!cancelled) setReconciliationState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const retryLedger = () => {
    setLedgerState({ status: "loading" });
    loadLedgerSummary().then(setLedgerState);
  };

  const retryReconciliation = () => {
    setReconciliationState({ status: "loading" });
    loadReconciliationDiagnostic().then(setReconciliationState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadDashboard().then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load the Finance dashboard." onRetry={retry} />;
  }

  const { data, clientsById } = state;
  const { metrics, recentInvoices, recentPayments, overdueInvoices, unpaidExpenses, alerts, eventsWithOutstandingBalance } =
    data;

  /** `null` means the server redacted this figure for the current session's permissions (see `financeActions.ts`) — rendered as "—", never as $0.00. */
  const money = (minor: number | null, currency = "USD") => (minor === null ? "—" : formatMoney(minor, currency));

  const metricCards = [
    { label: "Total Invoiced", value: money(metrics.totalInvoicedMinor), href: "/finance/invoices" },
    { label: "Total Collected", value: money(metrics.totalCollectedMinor), href: "/finance/payments" },
    {
      label: "Outstanding Receivables",
      value: money(metrics.outstandingReceivablesMinor),
      href: "/finance/invoices",
    },
    {
      label: "Overdue Receivables",
      value: money(metrics.overdueReceivablesMinor),
      href: "/finance/invoices",
    },
    { label: "Deposits Pending", value: money(metrics.depositsPendingMinor), href: "/finance/invoices" },
    {
      label: "Expenses This Month",
      value: money(metrics.expensesThisMonthMinor),
      href: "/finance/expenses",
    },
    { label: "Gross Profit", value: money(metrics.grossProfitMinor), href: "/finance" },
    { label: "Net Profit", value: money(metrics.netProfitMinor), href: "/finance" },
    {
      label: "Refunds This Month",
      value: money(metrics.refundsThisMonthMinor),
      href: "/finance/payments",
    },
    { label: "Unpaid Expenses", value: String(metrics.unpaidExpensesCount), href: "/finance/expenses" },
    { label: "Events Awaiting Deposit", value: String(metrics.eventsAwaitingDepositCount), href: "/events" },
    { label: "Events Paid in Full", value: String(metrics.eventsPaidInFullCount), href: "/events" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Finance"
        subtitle={`Invoices, payments, and expenses across the workspace. ${getDataPersistenceMessage()}`}
      />

      <FinanceLedgerNav />

      <div className="animate-fade-up grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <PaymentForecastCard />

      {alerts.length > 0 ? (
        <div className="animate-fade-up stagger-1 space-y-2">
          {alerts.map((alert) => (
            <Link key={alert.message} href={alert.href} className="block">
              <LuxuryCard
                className={`transition-colors duration-150 hover:border-accent/50 ${
                  alert.severity === "danger" ? "border-danger/40 bg-danger/5" : "border-accent/40 bg-accent/5"
                }`}
              >
                <p className={`text-sm font-medium ${alert.severity === "danger" ? "text-danger" : "text-accent"}`}>
                  {alert.message}
                </p>
              </LuxuryCard>
            </Link>
          ))}
        </div>
      ) : null}

      <div>
        <SectionHeader title="Overview" />
        <div className="animate-fade-up stagger-2 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LuxuryCard>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-semibold text-text">Recent Invoices</h3>
              <Link href="/finance/invoices" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
            {recentInvoices.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No invoices yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentInvoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      href={`/finance/invoices/${invoice.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{invoice.invoice_number}</p>
                        <p className="mt-0.5 text-xs text-text-muted">{clientName(clientsById, invoice.client_id)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm text-text">{money(invoice.total_minor, invoice.currency)}</span>
                        <InvoiceStatusBadge status={invoice.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <LuxuryCard>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-semibold text-text">Recent Payments</h3>
              <Link href="/finance/payments" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
            {recentPayments.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No payments yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentPayments.map((payment) => (
                  <li key={payment.id}>
                    <Link
                      href={`/finance/payments/${payment.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">
                          {clientName(clientsById, payment.client_id)}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">{formatEventDate(payment.transaction_date)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm text-text">{money(payment.amount_minor, payment.currency)}</span>
                        <PaymentStatusBadge status={payment.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <LuxuryCard>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-semibold text-text">Overdue Invoices</h3>
              <Link href="/finance/invoices" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
            {overdueInvoices.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No overdue invoices.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {overdueInvoices.map((invoice) => (
                  <li key={invoice.id}>
                    <Link
                      href={`/finance/invoices/${invoice.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{invoice.invoice_number}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {clientName(clientsById, invoice.client_id)} · Due {formatEventDate(invoice.due_date)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm text-danger">
                        {money(invoice.balance_minor, invoice.currency)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <LuxuryCard>
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-semibold text-text">Unpaid Expenses</h3>
              <Link href="/finance/expenses" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
            {unpaidExpenses.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No unpaid expenses.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {unpaidExpenses.map((expense) => (
                  <li key={expense.id}>
                    <Link
                      href={`/finance/expenses/${expense.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{expense.description}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          Due {formatEventDate(expense.due_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm text-text">{money(expense.amount_minor, expense.currency)}</span>
                        <ExpenseStatusBadge status={expense.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>

          <LuxuryCard className="lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-[17px] font-semibold text-text">Events With Outstanding Balances</h3>
              <Link href="/events" className="text-xs text-accent hover:underline">
                View all
              </Link>
            </div>
            {eventsWithOutstandingBalance.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No events currently have an outstanding balance.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {eventsWithOutstandingBalance.map(({ event, outstandingMinor, status }) => (
                  <li key={event.id}>
                    <Link
                      href={`/events/${event.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-accent/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{event.title}</p>
                        <p className="mt-0.5 text-xs text-text-muted">{formatEventDate(event.event_date)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm text-text">{money(outstandingMinor)}</span>
                        <EventFinancialStatusBadge status={status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </LuxuryCard>
        </div>
      </div>

      {ledgerState.status === "no-access" ? null : (
      <div>
        <SectionHeader title="General Ledger" />

        {ledgerState.status === "loading" ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[92px] rounded-xl" />
            ))}
          </div>
        ) : ledgerState.status === "error" ? (
          <div className="mt-4">
            <ErrorState message="Could not load the General Ledger summary." onRetry={retryLedger} />
          </div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="Active Accounts"
                value={String(ledgerState.activeAccountCount)}
                href="/finance/accounts"
              />
              <MetricCard
                label="Current Open Period"
                value={
                  ledgerState.openPeriod
                    ? `${formatEventDate(ledgerState.openPeriod.period_start)} – ${formatEventDate(ledgerState.openPeriod.period_end)}`
                    : "No open period"
                }
                href="/finance/periods"
              />
              <MetricCard
                label="Period Status"
                value={`${ledgerState.periodCounts.open} open · ${ledgerState.periodCounts.closed} closed · ${ledgerState.periodCounts.locked} locked`}
                href="/finance/periods"
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <LuxuryCard>
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-[17px] font-semibold text-text">Latest Journal Entries</h3>
                  <Link href="/finance/journal" className="text-xs text-accent hover:underline">
                    View all
                  </Link>
                </div>
                {ledgerState.latestEntries.length === 0 ? (
                  <p className="mt-3 text-sm text-text-muted">No journal entries yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {ledgerState.latestEntries.map((entry) => (
                      <li key={entry.id}>
                        <Link
                          href={`/finance/journal/${entry.id}`}
                          className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 hover:border-accent/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text">{entry.memo}</p>
                            <p className="mt-0.5 text-xs text-text-muted">{formatEventDate(entry.entry_date)}</p>
                          </div>
                          <PostingStatusBadge status={entry.posting_status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </LuxuryCard>

              <LuxuryCard>
                <h3 className="font-serif text-[17px] font-semibold text-text">Ledger Navigation</h3>
                <div className="mt-3 space-y-2">
                  <Link
                    href="/finance/accounts"
                    className="block rounded-md border border-border px-3 py-2 text-sm text-text hover:border-accent/50"
                  >
                    Chart of Accounts
                  </Link>
                  <Link
                    href="/finance/journal"
                    className="block rounded-md border border-border px-3 py-2 text-sm text-text hover:border-accent/50"
                  >
                    Journal Entries
                  </Link>
                  <Link
                    href="/finance/periods"
                    className="block rounded-md border border-border px-3 py-2 text-sm text-text hover:border-accent/50"
                  >
                    Accounting Periods
                  </Link>
                  {canCreate ? (
                    <Link href="/finance/journal/new" className="block">
                      <Button className="w-full">Record Manual Adjustment</Button>
                    </Link>
                  ) : null}
                </div>
              </LuxuryCard>
            </div>
          </>
        )}
      </div>
      )}

      {reconciliationState.status === "no-access" ? null : (
      <div className="mt-8">
        <SectionHeader title="Financial Reconciliation" />

        {reconciliationState.status === "loading" ? (
          <div className="mt-4">
            <Skeleton className="h-[120px] rounded-xl" />
          </div>
        ) : reconciliationState.status === "error" ? (
          <div className="mt-4">
            <ErrorState message="Could not load the reconciliation diagnostic." onRetry={retryReconciliation} />
          </div>
        ) : (
          <LuxuryCard className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-[17px] font-semibold text-text">
                {formatEventDate(reconciliationState.periodStartDate)} – {formatEventDate(reconciliationState.periodEndDate)}
              </h3>
              <span className={`text-sm font-medium ${reconciliationState.isReconciled ? "text-emerald-700" : "text-amber-700"}`}>
                {reconciliationState.isReconciled ? "✓ Reconciled" : "⚠ Review required"}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-text-muted">Operational Expenses</p>
                <p className="mt-1 text-lg font-semibold text-text">{formatMoney(reconciliationState.operationalExpenseMinor, "USD")}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Ledger Expenses</p>
                <p className="mt-1 text-lg font-semibold text-text">{formatMoney(reconciliationState.ledgerExpenseMinor, "USD")}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Difference</p>
                <p className="mt-1 text-lg font-semibold text-text">
                  {formatMoney(reconciliationState.operationalExpenseMinor - reconciliationState.ledgerExpenseMinor, "USD")}
                </p>
              </div>
            </div>

            {reconciliationState.notComparableMetrics.length > 0 ? (
              <p className="mt-4 border-t border-border pt-3 text-xs text-text-muted">
                Revenue and Net Income aren&rsquo;t shown here — {reconciliationState.notComparableReason}
              </p>
            ) : null}
          </LuxuryCard>
        )}
      </div>
      )}
    </div>
  );
}
