"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClients, getEvents, getInvoices, getPayments } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Payment } from "@/types/payment";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Invoice } from "@/types/invoice";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { CheckIcon, FinanceIcon, CloseIcon } from "@/components/ui/icons";
import { formatMoney, sumMinor } from "@/lib/money";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import {
  PaymentFilters,
  DEFAULT_PAYMENT_FILTERS,
  type PaymentFiltersValue,
} from "@/modules/finance/components/PaymentFilters";
import { PaymentListTable } from "@/modules/finance/components/PaymentListTable";
import { PaymentListCards } from "@/modules/finance/components/PaymentListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

export interface PaymentListRow {
  payment: Payment;
  client: Client | undefined;
  event: Event | undefined;
  invoice: Invoice | undefined;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: PaymentListRow[] };

function buildPaymentsInsight(rows: PaymentListRow[]): string | null {
  const failedCount = rows.filter((row) => row.payment.status === "failed").length;
  const refundedCount = rows.filter(
    (row) => row.payment.status === "refunded" || row.payment.status === "partially_refunded",
  ).length;

  if (failedCount > 0) {
    return `${failedCount} payment${failedCount === 1 ? "" : "s"} failed in this list.`;
  }
  if (refundedCount > 0) {
    return `${refundedCount} payment${refundedCount === 1 ? " is" : "s are"} refunded or partially refunded.`;
  }
  return null;
}

async function loadPaymentsFor(filters: PaymentFiltersValue): Promise<LoadState> {
  try {
    const [payments, clients, events, invoices] = await Promise.all([
      getPayments({
        search: filters.search,
        status: filters.status,
        paymentType: filters.paymentType,
        paymentMethod: filters.paymentMethod,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        refundsOnly: filters.refundsOnly,
      }),
      getClients({ includeArchived: true }),
      getEvents({ includeArchived: true }),
      getInvoices({ includeArchived: true }),
    ]);
    const clientsById = new Map(clients.map((client) => [client.id, client]));
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

    const rows = [...payments]
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
      .map((payment) => ({
        payment,
        client: clientsById.get(payment.client_id),
        event: payment.event_id ? eventsById.get(payment.event_id) : undefined,
        invoice: payment.invoice_id ? invoicesById.get(payment.invoice_id) : undefined,
      }));

    return { status: "ready", rows };
  } catch {
    return { status: "error" };
  }
}

export function PaymentsListView() {
  const { can } = useMemberSession();
  const canCreate = can("finance.create");
  const [filters, setFilters] = useState<PaymentFiltersValue>(DEFAULT_PAYMENT_FILTERS);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadPaymentsFor(debouncedFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, retryToken]);

  const handleFiltersChange = (next: PaymentFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
  };

  const retry = () => {
    setState({ status: "loading" });
    setRetryToken((token) => token + 1);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.paymentType !== "all" ||
    filters.paymentMethod !== "all" ||
    filters.refundsOnly ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const kpis =
    state.status === "ready"
      ? {
          total: state.rows.length,
          totalCollected: formatMoney(
            sumMinor(
              state.rows
                .filter((row) => PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(row.payment.status))
                .map((row) => row.payment.amount_minor),
            ),
            "USD",
          ),
          refunds: state.rows.filter((row) => row.payment.payment_type === "refund").length,
        }
      : null;
  const insight = state.status === "ready" ? buildPaymentsInsight(state.rows) : null;

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={`Every money movement — collected from a Client or refunded back to one. ${getDataPersistenceMessage()}`}
        actions={
          canCreate ? (
            <div className="flex gap-2">
              <Link href="/finance/payments/settle">
                <Button variant="secondary">Record Settlement</Button>
              </Link>
              <Link href="/finance/payments/new">
                <Button>Record Payment</Button>
              </Link>
            </div>
          ) : null
        }
      />

      {insight ? (
        <div className="animate-fade-up mb-6">
          <ModuleInsightCard insight={insight} tone={insight.includes("failed") ? "warning" : "info"} />
        </div>
      ) : null}

      {kpis ? (
        <div className="animate-fade-up stagger-1 mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard icon={CheckIcon} label="Total Payments" value={kpis.total.toLocaleString()} />
          <KpiCard icon={FinanceIcon} label="Total Collected" value={kpis.totalCollected} />
          <KpiCard icon={CloseIcon} label="Refunds" value={kpis.refunds.toLocaleString()} />
        </div>
      ) : null}

      <div className="mb-6">
        <PaymentFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div>
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load payments." onRetry={retry} />
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={FinanceIcon}
            title={hasActiveFilters ? "No payments match these filters" : "No payments yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New payments you record will show up here."
            }
            action={
              !hasActiveFilters && canCreate ? (
                <Link href="/finance/payments/new">
                  <Button>Record Payment</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="animate-fade-up stagger-2">
            <PaymentListTable rows={state.rows} />
            <PaymentListCards rows={state.rows} />
          </div>
        )}
      </div>
    </div>
  );
}
