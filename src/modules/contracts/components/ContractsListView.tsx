"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClients, getContractNextAction, getContractTemplates, getContracts, getEvents } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Contract } from "@/types/contract";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { ContractTemplate } from "@/types/contractTemplate";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { ContractsIcon, CheckIcon, FinanceIcon } from "@/components/ui/icons";
import { formatMoney, majorToMinor, sumMinor } from "@/lib/money";
import {
  ContractFilters,
  DEFAULT_CONTRACT_FILTERS,
  type ContractFiltersValue,
} from "@/modules/contracts/components/ContractFilters";
import { ContractListTable } from "@/modules/contracts/components/ContractListTable";
import { ContractListCards } from "@/modules/contracts/components/ContractListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

export interface ContractListRow {
  contract: Contract;
  client: Client | undefined;
  event: Event | undefined;
  template: ContractTemplate | undefined;
  nextAction: string | null;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: ContractListRow[] };

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function buildContractsInsight(rows: ContractListRow[]): string | null {
  const now = Date.now();
  const staleAwaitingSignature = rows.filter(
    (row) =>
      (row.contract.signature_status === "sent" || row.contract.signature_status === "viewed") &&
      now - new Date(row.contract.updated_at).getTime() > ONE_WEEK_MS,
  ).length;

  if (staleAwaitingSignature > 0) {
    return `${staleAwaitingSignature} contract${staleAwaitingSignature === 1 ? "" : "s"} ${
      staleAwaitingSignature === 1 ? "has" : "have"
    } been awaiting a signature for over a week.`;
  }
  return null;
}

function directionMultiplier(direction: ContractFiltersValue["sortDirection"]): number {
  return direction === "asc" ? 1 : -1;
}

function compareNullableDates(a: string | null, b: string | null, direction: ContractFiltersValue["sortDirection"]): number {
  const aTime = a ? new Date(a).getTime() : Infinity;
  const bTime = b ? new Date(b).getTime() : Infinity;
  return (aTime - bTime) * directionMultiplier(direction);
}

async function loadContractsFor(filters: ContractFiltersValue): Promise<LoadState> {
  try {
    const [contracts, clients, events, templates] = await Promise.all([
      getContracts({
        search: filters.search,
        status: filters.status,
        signatureStatus: filters.signatureStatus,
        effectiveDateFrom: filters.effectiveDateFrom || undefined,
        effectiveDateTo: filters.effectiveDateTo || undefined,
        includeArchived: filters.includeArchived,
      }),
      getClients({ includeArchived: true }),
      getEvents({ includeArchived: true }),
      getContractTemplates(),
    ]);
    const clientsById = new Map(clients.map((client) => [client.id, client]));
    const eventsById = new Map(events.map((event) => [event.id, event]));
    const templatesById = new Map(templates.map((template) => [template.id, template]));

    const filteredContracts =
      filters.templateCategory === "all"
        ? contracts
        : contracts.filter((contract) => {
            const template = contract.template_id ? templatesById.get(contract.template_id) : undefined;
            return template?.category === filters.templateCategory;
          });

    const rows = await Promise.all(
      filteredContracts.map(async (contract) => {
        const nextAction = await getContractNextAction(contract.id);
        return {
          contract,
          client: clientsById.get(contract.client_id),
          event: contract.event_id ? eventsById.get(contract.event_id) : undefined,
          template: contract.template_id ? templatesById.get(contract.template_id) : undefined,
          nextAction,
        };
      }),
    );

    const direction = directionMultiplier(filters.sortDirection);
    rows.sort((a, b) => {
      switch (filters.sortField) {
        case "effective":
          return compareNullableDates(a.contract.effective_date, b.contract.effective_date, filters.sortDirection);
        case "expiration":
          return compareNullableDates(a.contract.expiration_date, b.contract.expiration_date, filters.sortDirection);
        case "value": {
          const aValue = a.contract.total_value ?? -Infinity;
          const bValue = b.contract.total_value ?? -Infinity;
          return (aValue - bValue) * direction;
        }
        case "updated":
        default:
          return (
            (new Date(a.contract.updated_at).getTime() - new Date(b.contract.updated_at).getTime()) * direction
          );
      }
    });

    return { status: "ready", rows };
  } catch {
    return { status: "error" };
  }
}

export function ContractsListView() {
  const { can } = useMemberSession();
  const canCreate = can("contracts.create");
  const [filters, setFilters] = useState<ContractFiltersValue>(DEFAULT_CONTRACT_FILTERS);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadContractsFor(debouncedFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, retryToken]);

  const handleFiltersChange = (next: ContractFiltersValue) => {
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
    filters.signatureStatus !== "all" ||
    filters.templateCategory !== "all" ||
    filters.effectiveDateFrom !== "" ||
    filters.effectiveDateTo !== "";

  const kpis =
    state.status === "ready"
      ? {
          total: state.rows.length,
          signed: state.rows.filter((row) => row.contract.signature_status === "signed").length,
          totalValue: formatMoney(
            sumMinor(
              state.rows
                .filter((row) => row.contract.signature_status === "signed")
                .map((row) => majorToMinor(row.contract.total_value ?? 0)),
            ),
            "USD",
          ),
        }
      : null;
  const insight = state.status === "ready" ? buildContractsInsight(state.rows) : null;

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle={`Every agreement closing the commercial cycle from Client through Event. ${getDataPersistenceMessage()}`}
        actions={
          canCreate ? (
            <Link href="/contracts/new">
              <Button>New Contract</Button>
            </Link>
          ) : null
        }
      />

      <div className="space-y-8">
      {insight ? (
        <div className="animate-fade-up">
          <ModuleInsightCard insight={insight} tone="warning" />
        </div>
      ) : null}

      {kpis ? (
        <div className="animate-fade-up stagger-1 grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard icon={ContractsIcon} label="Total Contracts" value={kpis.total.toLocaleString()} />
          <KpiCard icon={CheckIcon} label="Signed" value={kpis.signed.toLocaleString()} />
          <KpiCard icon={FinanceIcon} label="Signed Value" value={kpis.totalValue} />
        </div>
      ) : null}

      <ContractFilters value={filters} onChange={handleFiltersChange} />

      <div>
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load contracts." onRetry={retry} />
        ) : state.rows.length === 0 ? (
          <EmptyState
            icon={ContractsIcon}
            title={hasActiveFilters ? "No contracts match these filters" : "No contracts yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New contracts you create will show up here."
            }
            action={
              !hasActiveFilters && canCreate ? (
                <Link href="/contracts/new">
                  <Button>New Contract</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="animate-fade-up stagger-2">
            <ContractListTable rows={state.rows} />
            <ContractListCards rows={state.rows} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
