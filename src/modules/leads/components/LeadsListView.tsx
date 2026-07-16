"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeads } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { Lead } from "@/types/lead";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LeadFilters, type LeadFiltersValue } from "@/modules/leads/components/LeadFilters";
import { LeadListTable } from "@/modules/leads/components/LeadListTable";
import { LeadListCards } from "@/modules/leads/components/LeadListCards";

const defaultFilters: LeadFiltersValue = {
  search: "",
  status: "all",
  source: "all",
  eventType: "all",
  includeArchived: false,
};

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; leads: Lead[] };

async function loadLeadsFor(filters: LeadFiltersValue): Promise<LoadState> {
  try {
    const leads = await getLeads({
      search: filters.search,
      status: filters.status,
      source: filters.source,
      eventType: filters.eventType,
      includeArchived: filters.includeArchived,
    });
    return { status: "ready", leads };
  } catch {
    return { status: "error" };
  }
}

export function LeadsListView() {
  const [filters, setFilters] = useState<LeadFiltersValue>(defaultFilters);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Fetch once on mount with the default filters. Every subsequent fetch is
  // triggered directly from the user interaction that changes the filters
  // (see handleFiltersChange) or from the retry button — not from an effect
  // reacting to `filters` state, since that state only ever changes because
  // of a direct user action.
  useEffect(() => {
    let cancelled = false;
    loadLeadsFor(defaultFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: LeadFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadLeadsFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadLeadsFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.source !== "all" ||
    filters.eventType !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-text">Leads</h2>
          <p className="mt-1 text-sm text-text-muted">
            Prospective clients moving through the Amoré Bloom pipeline. {getDataPersistenceMessage()}
          </p>
        </div>
        <Link href="/leads/new">
          <Button>New Lead</Button>
        </Link>
      </div>

      <div className="mt-6">
        <LeadFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load leads." onRetry={retry} />
        ) : state.leads.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No leads match these filters" : "No leads yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New leads you add will show up here."
            }
            action={
              !hasActiveFilters ? (
                <Link href="/leads/new">
                  <Button>New Lead</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <LeadListTable leads={state.leads} />
            <LeadListCards leads={state.leads} />
          </>
        )}
      </div>
    </div>
  );
}
