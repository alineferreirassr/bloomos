"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getEvents, getClients, getChecklistByEventId, getEventNextAction } from "@/lib/data";
import { getDataPersistenceMessage } from "@/lib/dataModeCopy";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ModuleInsightCard } from "@/components/ui/ModuleInsightCard";
import { EventsIcon, PipelineIcon, AutomationIcon, CheckIcon } from "@/components/ui/icons";
import { EventFilters, type EventFiltersValue } from "@/modules/events/components/EventFilters";
import { EventListTable } from "@/modules/events/components/EventListTable";
import { EventListCards } from "@/modules/events/components/EventListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { useSetCopilotPageContext } from "@/modules/ai/copilot/CopilotPageContextProvider";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface EventListRow {
  event: Event;
  client: Client | undefined;
  checklistCompleted: number;
  checklistTotal: number;
  nextAction: string | null;
}

function buildEventsInsight(rows: EventListRow[]): string | null {
  const now = Date.now();
  const soon = rows.filter((row) => {
    if (!row.event.event_date || row.event.status === "completed") return false;
    const eventTime = new Date(row.event.event_date).getTime();
    return eventTime >= now && eventTime - now <= SEVEN_DAYS_MS;
  });
  const incomplete = soon.filter((row) => row.checklistCompleted < row.checklistTotal);
  if (incomplete.length === 0) return null;
  return `${incomplete.length} event${incomplete.length === 1 ? "" : "s"} this week still ${
    incomplete.length === 1 ? "has" : "have"
  } an incomplete checklist.`;
}

const defaultFilters: EventFiltersValue = {
  search: "",
  status: "all",
  lifecycleStage: "all",
  eventType: "all",
  priority: "all",
  dateFrom: "",
  dateTo: "",
  includeArchived: false,
  sortDirection: "asc",
};

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: EventListRow[] };

async function loadEventsFor(filters: EventFiltersValue): Promise<LoadState> {
  try {
    const [events, clients] = await Promise.all([
      getEvents({
        search: filters.search,
        status: filters.status,
        lifecycleStage: filters.lifecycleStage,
        eventType: filters.eventType,
        priority: filters.priority,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        includeArchived: filters.includeArchived,
      }),
      getClients({ includeArchived: true }),
    ]);
    const clientsById = new Map(clients.map((client) => [client.id, client]));

    const rows = await Promise.all(
      events.map(async (event) => {
        const [checklist, nextAction] = await Promise.all([
          getChecklistByEventId(event.id),
          getEventNextAction(event.id),
        ]);
        return {
          event,
          client: clientsById.get(event.client_id),
          checklistCompleted: checklist.filter((item) => item.status === "completed").length,
          checklistTotal: checklist.length,
          nextAction,
        };
      }),
    );

    rows.sort((a, b) => {
      const aTime = a.event.event_date ? new Date(a.event.event_date).getTime() : Infinity;
      const bTime = b.event.event_date ? new Date(b.event.event_date).getTime() : Infinity;
      return filters.sortDirection === "desc" ? bTime - aTime : aTime - bTime;
    });

    return { status: "ready", rows };
  } catch {
    return { status: "error" };
  }
}

export function EventsListView() {
  const { can } = useMemberSession();
  const canCreate = can("events.create");
  const [filters, setFilters] = useState<EventFiltersValue>(defaultFilters);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  useSetCopilotPageContext({ module: "events", entity: null });

  // Fetch once on mount with the default filters. Every subsequent fetch is
  // triggered directly from the user interaction that changes the filters
  // (see handleFiltersChange) or from the retry button — same pattern as
  // LeadsListView/ClientsListView.
  useEffect(() => {
    let cancelled = false;
    loadEventsFor(defaultFilters).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiltersChange = (next: EventFiltersValue) => {
    setFilters(next);
    setState({ status: "loading" });
    loadEventsFor(next).then(setState);
  };

  const retry = () => {
    setState({ status: "loading" });
    loadEventsFor(filters).then(setState);
  };

  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "all" ||
    filters.lifecycleStage !== "all" ||
    filters.eventType !== "all" ||
    filters.priority !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "";

  const kpis =
    state.status === "ready"
      ? {
          total: state.rows.length,
          upcoming: state.rows.filter(
            (row) => row.event.event_date !== null && new Date(row.event.event_date) >= new Date(),
          ).length,
          inProgress: state.rows.filter((row) => row.event.status === "in_progress").length,
          completed: state.rows.filter((row) => row.event.status === "completed").length,
        }
      : null;

  const insight = state.status === "ready" ? buildEventsInsight(state.rows) : null;

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle={`The operational center for every engagement Amoré Bloom is planning. ${getDataPersistenceMessage()}`}
        actions={
          canCreate ? (
            <Link href="/events/new">
              <Button>New Event</Button>
            </Link>
          ) : null
        }
      />

      {kpis ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard icon={EventsIcon} label="Total Events" value={kpis.total.toLocaleString()} />
          <KpiCard icon={PipelineIcon} label="Upcoming" value={kpis.upcoming.toLocaleString()} />
          <KpiCard icon={AutomationIcon} label="In Progress" value={kpis.inProgress.toLocaleString()} />
          <KpiCard icon={CheckIcon} label="Completed" value={kpis.completed.toLocaleString()} />
        </div>
      ) : null}

      {insight ? (
        <div className="mb-6">
          <ModuleInsightCard tone="warning" insight={insight} />
        </div>
      ) : null}

      <div className="mb-6">
        <EventFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div>
        {state.status === "loading" ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : state.status === "error" ? (
          <ErrorState message="Could not load events." onRetry={retry} />
        ) : state.rows.length === 0 ? (
          <EmptyState
            illustration={hasActiveFilters ? undefined : "events"}
            title={hasActiveFilters ? "No events match these filters" : "No events yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "Every unforgettable celebration begins with a plan — create your first Event."
            }
            action={
              !hasActiveFilters && canCreate ? (
                <Link href="/events/new">
                  <Button>New Event</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <EventListTable rows={state.rows} />
            <EventListCards rows={state.rows} />
          </>
        )}
      </div>
    </div>
  );
}
