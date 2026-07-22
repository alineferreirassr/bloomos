"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClients, getContracts, getEvents, getInvoiceNextAction, getInvoices } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { Invoice } from "@/types/invoice";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  InvoiceFilters,
  DEFAULT_INVOICE_FILTERS,
  type InvoiceFiltersValue,
} from "@/modules/finance/components/InvoiceFilters";
import { InvoiceListTable } from "@/modules/finance/components/InvoiceListTable";
import { InvoiceListCards } from "@/modules/finance/components/InvoiceListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

export interface InvoiceListRow {
  invoice: Invoice;
  client: Client | undefined;
  event: Event | undefined;
  contract: Contract | undefined;
  nextAction: string | null;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: InvoiceListRow[] };

function directionMultiplier(direction: InvoiceFiltersValue["sortDirection"]): number {
  return direction === "asc" ? 1 : -1;
}

function compareNullableDates(a: string | null, b: string | null, direction: InvoiceFiltersValue["sortDirection"]): number {
  const aTime = a ? new Date(a).getTime() : Infinity;
  const bTime = b ? new Date(b).getTime() : Infinity;
  return (aTime - bTime) * directionMultiplier(direction);
}

async function loadInvoicesFor(filters: InvoiceFiltersValue): Promise<LoadState> {
  try {
    const [invoices, clients, events, contracts] = await Promise.all([
      getInvoices({
        search: filters.search,
        status: filters.status,
        issueDateFrom: filters.issueDateFrom || undefined,
        issueDateTo: filters.issueDateTo || undefined,
        dueDateFrom: filters.dueDateFrom || undefined,
        dueDateTo: filters.dueDateTo || undefined,
        overdueOnly: filters.overdueOnly,
        includeArchived: filters.includeArchived,
      }),
      getClients({ includeArchived: true }),
      getEvents({ includeArchived: true }),
      getContracts({ includeArchived: true }),
    ]);
    const clientsById = new Map(clients.map((client) => [client.id, client]));
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const contractsById = new Map(contracts.map((contract) => [contract.id, contract]));

    const rows = await Promise.all(
      invoices.map(async (invoice) => {
        const nextAction = await getInvoiceNextAction(invoice.id);
        return {
          invoice,
          client: clientsById.get(invoice.client_id),
          event: invoice.event_id ? eventsById.get(invoice.event_id) : undefined,
          contract: invoice.contract_id ? contractsById.get(invoice.contract_id) : undefined,
          nextAction,
        };
      }),
    );

    const direction = directionMultiplier(filters.sortDirection);
    rows.sort((a, b) => {
      switch (filters.sortField) {
        case "due":
          return compareNullableDates(a.invoice.due_date, b.invoice.due_date, filters.sortDirection);
        case "issue":
          return compareNullableDates(a.invoice.issue_date, b.invoice.issue_date, filters.sortDirection);
        case "balance":
          return (a.invoice.balance_minor - b.invoice.balance_minor) * direction;
        case "total":
          return (a.invoice.total_minor - b.invoice.total_minor) * direction;
        case "updated":
        default:
          return (
            (new Date(a.invoice.updated_at).getTime() - new Date(b.invoice.updated_at).getTime()) * direction
          );
      }
    });

    return { status: "ready", rows };
  } catch {
    return { status: "error" };
  }
}

export function InvoicesListView() {
  const { can } = useMemberSession();
  const canCreate = can("finance.create");
  const [filters, setFilters] = useState<InvoiceFiltersValue>(DEFAULT_INVOICE_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadInvoicesFor(DEFAULT_INVOICE_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: InvoiceFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadInvoicesFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadInvoicesFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.overdueOnly ||
    filters.issueDateFrom !== "" ||
    filters.issueDateTo !== "" ||
    filters.dueDateFrom !== "" ||
    filters.dueDateTo !== "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text">Invoices</h2>
          <p className="mt-1 text-sm text-text-muted">
            Every invoice billed to a Client, standalone or linked to an Event and Contract.
            {" "}{getDataPersistenceMessage()}
          </p>
        </div>
        {canCreate ? (
          <Link href="/finance/invoices/new">
            <Button>New Invoice</Button>
          </Link>
        ) : null}
      </div>

      <div className="mt-6">
        <InvoiceFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load invoices." onRetry={retry} />
        ) : state.rows.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No invoices match these filters" : "No invoices yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New invoices you create will show up here."
            }
            action={
              !hasActiveFilters && canCreate ? (
                <Link href="/finance/invoices/new">
                  <Button>New Invoice</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <InvoiceListTable rows={state.rows} />
            <InvoiceListCards rows={state.rows} />
          </>
        )}
      </div>
    </div>
  );
}
