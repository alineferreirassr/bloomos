"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClients, getContractNextAction, getContractTemplates, getContracts, getEvents } from "@/lib/data";
import type { Contract } from "@/types/contract";
import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { ContractTemplate } from "@/types/contractTemplate";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import {
  ContractFilters,
  DEFAULT_CONTRACT_FILTERS,
  type ContractFiltersValue,
} from "@/modules/contracts/components/ContractFilters";
import { ContractListTable } from "@/modules/contracts/components/ContractListTable";
import { ContractListCards } from "@/modules/contracts/components/ContractListCards";

export interface ContractListRow {
  contract: Contract;
  client: Client | undefined;
  event: Event | undefined;
  template: ContractTemplate | undefined;
  nextAction: string | null;
}

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; rows: ContractListRow[] };

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
  const [filters, setFilters] = useState<ContractFiltersValue>(DEFAULT_CONTRACT_FILTERS);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadContractsFor(DEFAULT_CONTRACT_FILTERS).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: ContractFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadContractsFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadContractsFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.signatureStatus !== "all" ||
    filters.templateCategory !== "all" ||
    filters.effectiveDateFrom !== "" ||
    filters.effectiveDateTo !== "";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-text">Contracts</h2>
          <p className="mt-1 text-sm text-text-muted">
            Every agreement closing the commercial cycle from Client through Event.
            Data resets on page reload — there&apos;s no database behind this yet.
          </p>
        </div>
        <Link href="/contracts/new">
          <Button>New Contract</Button>
        </Link>
      </div>

      <div className="mt-6">
        <ContractFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
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
            title={hasActiveFilters ? "No contracts match these filters" : "No contracts yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New contracts you create will show up here."
            }
            action={
              !hasActiveFilters ? (
                <Link href="/contracts/new">
                  <Button>New Contract</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ContractListTable rows={state.rows} />
            <ContractListCards rows={state.rows} />
          </>
        )}
      </div>
    </div>
  );
}
