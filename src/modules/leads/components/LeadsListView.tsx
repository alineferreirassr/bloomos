"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeads } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { Lead } from "@/types/lead";
import { Button } from "@/components/ui/Button";
import { CardGridSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { ModuleHero } from "@/components/ui/ModuleHero";
import { ConnectedRail } from "@/components/ui/ConnectedRail";
import { StatusSummary } from "@/components/ui/StatusSummary";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { LeadsIcon, PlusIcon, CheckIcon, ClientsIcon } from "@/components/ui/icons";
import { useSetCopilotPageContext } from "@/modules/ai/copilot/CopilotPageContextProvider";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function buildLeadsInsight(leads: Lead[]): string | null {
  const now = Date.now();
  const recentCount = leads.filter((lead) => now - new Date(lead.created_at).getTime() <= ONE_WEEK_MS).length;
  const staleQualified = leads.filter(
    (lead) => lead.status === "qualified" && now - new Date(lead.updated_at).getTime() > ONE_WEEK_MS,
  ).length;

  if (recentCount > 0) {
    return `${recentCount} new lead${recentCount === 1 ? "" : "s"} arrived in the last 7 days.`;
  }
  if (staleQualified > 0) {
    return `${staleQualified} qualified lead${staleQualified === 1 ? "" : "s"} ${staleQualified === 1 ? "hasn't" : "haven't"} been touched in over a week.`;
  }
  return null;
}
import { LeadFilters, type LeadFiltersValue } from "@/modules/leads/components/LeadFilters";
import { LeadListTable } from "@/modules/leads/components/LeadListTable";
import { LeadListCards } from "@/modules/leads/components/LeadListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

const defaultFilters: LeadFiltersValue = {
  search: "",
  status: "all",
  source: "all",
  eventType: "all",
  includeArchived: false,
  unassignedOnly: false,
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
      unassignedOnly: filters.unassignedOnly,
    });
    return { status: "ready", leads };
  } catch {
    return { status: "error" };
  }
}

export function LeadsListView() {
  const { can } = useMemberSession();
  const canCreate = can("leads.create");
  const [filters, setFilters] = useState<LeadFiltersValue>(defaultFilters);
  const debouncedFilters = useDebouncedValue(filters, 300);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [retryToken, setRetryToken] = useState(0);
  useSetCopilotPageContext({ module: "crm", entity: null });

  // Fetch once on mount with the default filters, then refetch whenever the
  // debounced filters change (so a search keystroke doesn't trigger a
  // request until typing pauses) or the user hits retry — never on every
  // raw `filters` change directly.
  useEffect(() => {
    let cancelled = false;
    loadLeadsFor(debouncedFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedFilters, retryToken]);

  const handleFiltersChange = (next: LeadFiltersValue) => {
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
    filters.eventType !== "all" ||
    filters.unassignedOnly;

  const kpis =
    state.status === "ready"
      ? {
          total: state.leads.length,
          new: state.leads.filter((lead) => lead.status === "new").length,
          qualified: state.leads.filter((lead) => lead.status === "qualified").length,
          converted: state.leads.filter((lead) => lead.status === "converted").length,
        }
      : null;
  const insight = state.status === "ready" ? buildLeadsInsight(state.leads) : null;

  return (
    // GLOBAL-VISUAL-04 — content capped to AF's own measured max-w-6xl
    // (1152px), same as Relationships (GLOBAL-VISUAL-03B.2/03B.3).
    <div className="mx-auto max-w-6xl space-y-8">
      {/* GLOBAL-VISUAL-04 — ModuleHero(compact), matching AF's own real
          Leads page (app/(app)/app/leads/page.tsx, HEAD 1587d1f), which
          uses the compact hero for every dense list/work screen. AF's own
          Leads hero carries exactly ONE status figure ("Leads in view");
          the New/Qualified/Converted breakdown AF's page doesn't show is
          real BloomOS data worth keeping, so it moves to a secondary
          StatusSummary row below — the same real component, the same
          pattern already established for Relationships' own secondary
          figures, not a new invention. */}
      <ModuleHero
        compact
        eyebrow="Leads"
        title="Leads"
        purpose="Prospective clients moving through the Amoré Bloom pipeline, from first contact to a signed engagement."
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Leads" }]}
        status={kpis ? [{ label: "Total Leads", value: kpis.total, icon: LeadsIcon }] : undefined}
        actions={
          canCreate ? (
            <Link href="/leads/new">
              <Button>New Lead</Button>
            </Link>
          ) : null
        }
        source={
          <p className="flex items-center gap-1.5 text-xs text-text-muted/80">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {getDataPersistenceMessage()}
          </p>
        }
      />

      <section aria-label="Where Leads sits in your workflow">
        <ConnectedRail
          items={[
            { label: "Relationships", href: "/relationships" },
            { label: "Leads", current: true },
            { label: "Clients", href: "/clients" },
            { label: "Commercial Pipeline", href: "/pipeline/commercial" },
          ]}
        />
      </section>

      {insight ? (
        <div className="animate-fade-up">
          <ModuleInsightCard insight={insight} />
        </div>
      ) : null}

      {kpis ? (
        <StatusSummary
          items={[
            { label: "New", value: kpis.new, icon: PlusIcon },
            { label: "Qualified", value: kpis.qualified, icon: CheckIcon },
            { label: "Converted", value: kpis.converted, icon: ClientsIcon },
          ]}
        />
      ) : state.status === "loading" ? (
        <CardGridSkeleton count={3} />
      ) : null}

      <LeadFilters value={filters} onChange={handleFiltersChange} />

      <div>
        {state.status === "loading" ? (
          <TableSkeleton rows={5} columns={6} />
        ) : state.status === "error" ? (
          <ErrorState message="Could not load leads." onRetry={retry} />
        ) : state.leads.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters ? LeadsIcon : undefined}
            illustration={hasActiveFilters ? undefined : "leads"}
            title={hasActiveFilters ? "No leads match these filters" : "No leads yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "Your next unforgettable event starts here — create your first Lead."
            }
            action={
              !hasActiveFilters && canCreate ? (
                <Link href="/leads/new">
                  <Button>New Lead</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="animate-fade-up stagger-2">
            <LeadListTable leads={state.leads} />
            <LeadListCards leads={state.leads} />
          </div>
        )}
      </div>
    </div>
  );
}
