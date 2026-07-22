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
import { EventFilters, type EventFiltersValue } from "@/modules/events/components/EventFilters";
import { EventListTable } from "@/modules/events/components/EventListTable";
import { EventListCards } from "@/modules/events/components/EventListCards";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

export interface EventListRow {
  event: Event;
  client: Client | undefined;
  checklistCompleted: number;
  checklistTotal: number;
  nextAction: string | null;
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-semibold text-text">Events</h2>
          <p className="mt-1 text-sm text-text-muted">
            The operational center for every engagement Amoré Bloom is planning.
            {" "}{getDataPersistenceMessage()}
          </p>
        </div>
        {canCreate ? (
          <Link href="/events/new">
            <Button>New Event</Button>
          </Link>
        ) : null}
      </div>

      <div className="mt-6">
        <EventFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-6">
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
            title={hasActiveFilters ? "No events match these filters" : "No events yet"}
            description={
              hasActiveFilters
                ? "Try adjusting or clearing your filters."
                : "New events you create will show up here."
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
