"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClients, getContracts, getEvents, getInvoiceNextAction, getInvoices } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Invoice } from "@/types/invoice";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { Contract } from "@/types/contract";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { ContractsIcon, PipelineIcon, FinanceIcon } from "@/components/ui/icons";
import { formatMoney, sumMinor } from "@/lib/money";
import {
  InvoiceFilters,
  DEFAULT_INVOICE_FILTERS,
  type InvoiceFiltersValue,
} from "@/modules/finance/components/InvoiceFilters";
import { InvoiceListTable } from "@/modules/finance/components/InvoiceListTable";
import { useSetCopilotPageContext } from "@/modules/ai/copilot/CopilotPageContextProvider";
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

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function buildInvoicesInsight(rows: InvoiceListRow[]): string | null {
  const now = Date.now();
  const overdueCount = rows.filter((row) => row.invoice.status === "overdue").length;
  const dueSoonCount = rows.filter((row) => {
    if (row.invoice.status === "overdue" || row.invoice.balance_minor <= 0 || !row.invoice.due_date) return false;
    const dueTime = new Date(row.invoice.due_date).getTime();
    return dueTime >= now && dueTime - now <= ONE_WEEK_MS;
  }).length;

  if (overdueCount > 0) {
    return `${overdueCount} invoice${overdueCount === 1 ? " is" : "s are"} overdue.`;
  }
  if (dueSoonCount > 0) {
    return `${dueSoonCount} invoice${dueSoonCount === 1 ? "" : "s"} due in the next 7 days.`;
  }
  return null;
}

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
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  useSetCopilotPageContext({ module: "finance", entity: null });

  useEffect(() => {
    let cancelled = false;
    loadInvoicesFor(debouncedFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, retryToken]);

  const handleFiltersChange = (next: InvoiceFiltersValue) => {
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
    filters.overdueOnly ||
    filters.issueDateFrom !== "" ||
    filters.issueDateTo !== "" ||
    filters.dueDateFrom !== "" ||
    filters.dueDateTo !== "";

  const kpis =
    state.status === "ready"
      ? {
          total: state.rows.length,
          outstanding: state.rows.filter((row) => row.invoice.balance_minor > 0).length,
          totalBilled: formatMoney(
            sumMinor(state.rows.map((row) => row.invoice.total_minor)),
            "USD",
          ),
        }
      : null;
  const insight = state.status === "ready" ? buildInvoicesInsight(state.rows) : null;

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle={`Every invoice billed to a Client, standalone or linked to an Event and Contract. ${getDataPersistenceMessage()}`}
        actions={
          canCreate ? (
            <Link href="/finance/invoices/new">
              <Button>New Invoice</Button>
            </Link>
          ) : null
        }
      />

      {insight ? (
        <div className="animate-fade-up mb-6">
          <ModuleInsightCard insight={insight} tone={insight.includes("overdue") ? "warning" : "info"} />
        </div>
      ) : null}

      {kpis ? (
        <div className="animate-fade-up stagger-1 mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard icon={ContractsIcon} label="Total Invoices" value={kpis.total.toLocaleString()} />
          <KpiCard icon={PipelineIcon} label="Outstanding" value={kpis.outstanding.toLocaleString()} />
          <KpiCard icon={FinanceIcon} label="Total Billed" value={kpis.totalBilled} />
        </div>
      ) : null}

      <div className="mb-6">
        <InvoiceFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div>
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
            icon={FinanceIcon}
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
          <div className="animate-fade-up stagger-2">
            <InvoiceListTable rows={state.rows} />
            <InvoiceListCards rows={state.rows} />
          </div>
        )}
      </div>
    </div>
  );
}
