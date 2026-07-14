"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientNextAction, getClients } from "@/lib/data";
import type { Client } from "@/types/client";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ClientFilters, type ClientFiltersValue } from "@/modules/clients/components/ClientFilters";
import { ClientListTable } from "@/modules/clients/components/ClientListTable";
import { ClientListCards } from "@/modules/clients/components/ClientListCards";

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
  const [filters, setFilters] = useState<ClientFiltersValue>(defaultFilters);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Same rationale as LeadsListView: fetch once on mount, then only ever
  // refetch in direct response to a user action (filter change, retry).
  useEffect(() => {
    let cancelled = false;
    loadClientsFor(defaultFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: ClientFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadClientsFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadClientsFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.source !== "all" ||
    filters.tag !== "" ||
    filters.vipOnly;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text">Clients</h2>
          <p className="mt-1 text-sm text-text-muted">
            Ongoing relationships with Amoré Bloom, converted from Leads or added
            directly. Data resets on page reload — there&apos;s no database
            behind this yet.
          </p>
        </div>
        <Link href="/clients/new">
          <Button>New Client</Button>
        </Link>
      </div>

      <div className="mt-6">
        <ClientFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
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
            title={hasActiveFilters ? "No clients match these filters" : "No clients yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "Clients converted from Leads, or added directly, will show up here."
            }
            action={
              !hasActiveFilters ? (
                <Link href="/clients/new">
                  <Button>New Client</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <ClientListTable clients={state.clients} nextActionByClientId={state.nextActionByClientId} />
            <ClientListCards clients={state.clients} nextActionByClientId={state.nextActionByClientId} />
          </>
        )}
      </div>
    </div>
  );
}
