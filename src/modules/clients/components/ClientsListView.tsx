"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientNextAction, getClients } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Client } from "@/types/client";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { ClientsIcon, CheckIcon, BloomAiIcon } from "@/components/ui/icons";
import { ClientFilters, type ClientFiltersValue } from "@/modules/clients/components/ClientFilters";
import { ClientListTable } from "@/modules/clients/components/ClientListTable";
import { ClientListCards } from "@/modules/clients/components/ClientListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

function buildClientsInsight(clients: Client[]): string | null {
  const vipMissingPhone = clients.filter((client) => client.is_vip && !client.phone).length;
  if (vipMissingPhone > 0) {
    return `${vipMissingPhone} VIP client${vipMissingPhone === 1 ? "" : "s"} ${vipMissingPhone === 1 ? "has" : "have"} no phone number on file.`;
  }
  const missingPhone = clients.filter((client) => !client.phone).length;
  if (missingPhone > 0) {
    return `${missingPhone} client${missingPhone === 1 ? "" : "s"} ${missingPhone === 1 ? "has" : "have"} no phone number on file.`;
  }
  return null;
}

const defaultFilters: ClientFiltersValue = {
  search: "",
  status: "all",
  source: "all",
  tag: "",
  vipOnly: false,
  includeArchived: false,
};

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; clients: Client[]; nextActionByClientId: Record<string, string | null> };

async function loadClientsFor(filters: ClientFiltersValue): Promise<LoadState> {
  try {
    const clients = await getClients({
      search: filters.search,
      status: filters.status,
      source: filters.source,
      tags: filters.tag.trim() ? [filters.tag.trim()] : undefined,
      vipOnly: filters.vipOnly,
      includeArchived: filters.includeArchived,
    });
    const nextActions = await Promise.all(clients.map((client) => getClientNextAction(client.id)));
    const nextActionByClientId: Record<string, string | null> = {};
    clients.forEach((client, index) => {
      nextActionByClientId[client.id] = nextActions[index];
    });
    return { status: "ready", clients, nextActionByClientId };
  } catch {
    return { status: "error" };
  }
}

export function ClientsListView() {
  const { can } = useMemberSession();
  const canCreate = can("clients.create");
  const [filters, setFilters] = useState<ClientFiltersValue>(defaultFilters);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);

  // Debounced so a search keystroke doesn't trigger a refetch until typing
  // pauses; the `cancelled` guard still protects against a stale response
  // landing after a newer request was already issued.
  useEffect(() => {
    let cancelled = false;
    loadClientsFor(debouncedFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, retryToken]);

  const handleFiltersChange = (next: ClientFiltersValue) => {
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
    filters.source !== "all" ||
    filters.tag !== "" ||
    filters.vipOnly;

  const kpis =
    state.status === "ready"
      ? {
          total: state.clients.length,
          active: state.clients.filter((client) => client.internal_status === "active").length,
          vip: state.clients.filter((client) => client.is_vip).length,
        }
      : null;
  const insight = state.status === "ready" ? buildClientsInsight(state.clients) : null;

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle={`Ongoing relationships with Amoré Bloom, converted from Leads or added directly. ${getDataPersistenceMessage()}`}
        actions={
          canCreate ? (
            <Link href="/clients/new">
              <Button>New Client</Button>
            </Link>
          ) : null
        }
      />

      {insight ? (
        <div className="animate-fade-up mb-6">
          <ModuleInsightCard insight={insight} />
        </div>
      ) : null}

      {kpis ? (
        <div className="animate-fade-up stagger-1 mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
          <KpiCard icon={ClientsIcon} label="Total Clients" value={kpis.total.toLocaleString()} />
          <KpiCard icon={CheckIcon} label="Active" value={kpis.active.toLocaleString()} />
          <KpiCard icon={BloomAiIcon} label="VIP" value={kpis.vip.toLocaleString()} />
        </div>
      ) : null}

      <div className="mb-6">
        <ClientFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div>
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load clients." onRetry={retry} />
        ) : state.clients.length === 0 ? (
          <EmptyState
            icon={ClientsIcon}
            title={hasActiveFilters ? "No clients match these filters" : "No clients yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "Clients converted from Leads, or added directly, will show up here."
            }
            action={
              !hasActiveFilters && canCreate ? (
                <Link href="/clients/new">
                  <Button>New Client</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="animate-fade-up stagger-2">
            <ClientListTable clients={state.clients} nextActionByClientId={state.nextActionByClientId} />
            <ClientListCards clients={state.clients} nextActionByClientId={state.nextActionByClientId} />
          </div>
        )}
      </div>
    </div>
  );
}
