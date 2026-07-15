"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClients, getEvents, getInvoices, getPayments } from "@/lib/data";
import type { Payment } from "@/types/payment";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Invoice } from "@/types/invoice";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  PaymentFilters,
  DEFAULT_PAYMENT_FILTERS,
  type PaymentFiltersValue,
} from "@/modules/finance/components/PaymentFilters";
import { PaymentListTable } from "@/modules/finance/components/PaymentListTable";
import { PaymentListCards } from "@/modules/finance/components/PaymentListCards";

export interface PaymentListRow {
  payment: Payment;
  client: Client | undefined;
  event: Event | undefined;
  invoice: Invoice | undefined;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: PaymentListRow[] };

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
  const [filters, setFilters] = useState<PaymentFiltersValue>(DEFAULT_PAYMENT_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadPaymentsFor(DEFAULT_PAYMENT_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: PaymentFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadPaymentsFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadPaymentsFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.paymentType !== "all" ||
    filters.paymentMethod !== "all" ||
    filters.refundsOnly ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text">Payments</h2>
          <p className="mt-1 text-sm text-text-muted">
            Every money movement — collected from a Client or refunded back to one.
            Data resets on page reload — there&apos;s no database behind this yet.
          </p>
        </div>
        <Link href="/finance/payments/new">
          <Button>Record Payment</Button>
        </Link>
      </div>

      <div className="mt-6">
        <PaymentFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
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
            title={hasActiveFilters ? "No payments match these filters" : "No payments yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New payments you record will show up here."
            }
            action={
              !hasActiveFilters ? (
                <Link href="/finance/payments/new">
                  <Button>Record Payment</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <PaymentListTable rows={state.rows} />
            <PaymentListCards rows={state.rows} />
          </>
        )}
      </div>
    </div>
  );
}
