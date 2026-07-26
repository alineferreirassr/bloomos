"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getClientById, getEventById, getScheduleByEventId, reorderScheduleItems } from "@/lib/data";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import { NotFoundError } from "@/core/errors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import { computeScheduleStats } from "@/modules/events/scheduleStats";
import {
  ScheduleFilters,
  DEFAULT_SCHEDULE_FILTERS,
  type ScheduleFiltersValue,
} from "@/modules/events/components/ScheduleFilters";
import { ScheduleItemRow } from "@/modules/events/components/ScheduleItemRow";
import { ScheduleItemForm } from "@/modules/events/components/ScheduleItemForm";
import { ConfirmDeleteScheduleItemModal } from "@/modules/events/components/ConfirmDeleteScheduleItemModal";
import { getFullName } from "@/lib/personName";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; event: Event; client: Client | null; schedule: EventScheduleItem[] };

async function loadSchedule(eventId: string): Promise<LoadState> {
  try {
    const event = await getEventById(eventId);
    const [client, schedule] = await Promise.all([
      getClientById(event.client_id).catch(() => null),
      getScheduleByEventId(eventId),
    ]);
    return { status: "ready", event, client, schedule: [...schedule].sort((a, b) => a.sort_order - b.sort_order) };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

/**
 * Chronological order is authoritative: items with a start_time always sort
 * by that time first; items without one sort after every timed item.
 * sort_order only breaks ties (equal times, or both untimed) — this mirrors
 * the exact rule the spec asked for, and is why the reorder controls below
 * are disabled whenever swapping two items wouldn't change what's displayed
 * (their times already fix their relative order).
 */
function chronologicalCompare(a: EventScheduleItem, b: EventScheduleItem): number {
  if (a.start_time === null && b.start_time === null) return a.sort_order - b.sort_order;
  if (a.start_time === null) return 1;
  if (b.start_time === null) return -1;
  if (a.start_time !== b.start_time) return a.start_time < b.start_time ? -1 : 1;
  return a.sort_order - b.sort_order;
}

function matchesFilters(item: EventScheduleItem, filters: ScheduleFiltersValue): boolean {
  if (!filters.showCompleted && item.status === "completed") return false;
  if (filters.category !== "all" && item.category !== filters.category) return false;
  if (filters.status !== "all" && item.status !== filters.status) return false;
  if (filters.assignedTo === "unassigned" && item.assigned_to !== null) return false;
  if (filters.assignedTo !== "all" && filters.assignedTo !== "unassigned" && item.assigned_to !== filters.assignedTo)
    return false;
  if (filters.delayedOnly && item.status !== "delayed") return false;
  if (filters.search.trim() !== "") {
    const needle = filters.search.trim().toLowerCase();
    const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

type ModalState =
  | { kind: "create" }
  | { kind: "edit"; item: EventScheduleItem }
  | { kind: "delete"; item: EventScheduleItem }
  | null;

export function EventScheduleView({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filters, setFilters] = useState<ScheduleFiltersValue>(DEFAULT_SCHEDULE_FILTERS);
  const [modal, setModal] = useState<ModalState>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadSchedule(eventId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const refetch = () => {
    loadSchedule(eventId).then(setState);
  };

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "not-found") {
    return <ErrorState message="This event could not be found." />;
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load this schedule." onRetry={refetch} />;
  }

  const { event, client, schedule } = state;
  const readOnly = event.status === "archived" || event.status === "cancelled";
  const stats = computeScheduleStats(schedule);

  const chronological = [...schedule].sort(chronologicalCompare);
  const assignedOptions = [...new Set(schedule.map((item) => item.assigned_to).filter((v): v is string => v !== null))].sort();
  const visibleItems = chronological.filter((item) => matchesFilters(item, filters));

  const moveItem = async (itemId: string, direction: "up" | "down") => {
    setReorderError(null);
    const index = chronological.findIndex((item) => item.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= chronological.length) return;

    const reordered = [...chronological];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    try {
      const result = await reorderScheduleItems(eventId, reordered.map((item) => item.id));
      if (!result.success) {
        setReorderError(result.error);
        return;
      }
      refetch();
    } catch (err) {
      setReorderError(err instanceof Error ? err.message : "Could not reorder the schedule. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/events/${event.id}`} className="text-sm text-accent hover:underline">
          ← Back to {event.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">Schedule</h2>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {event.title}
          {client ? ` · ${getFullName(client)}` : ""}
          {event.event_date ? ` · ${formatEventDate(event.event_date)}` : ""}
          {" · "}
          {stats.total} item{stats.total === 1 ? "" : "s"}
          {stats.delayed > 0 ? ` · ${stats.delayed} delayed` : ""}
          {` · ${stats.completed} completed`}
        </p>

        {!readOnly ? (
          <div className="mt-4">
            <Button onClick={() => setModal({ kind: "create" })}>Add Schedule Item</Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            This event is {event.status} — the schedule is read-only.
          </p>
        )}
      </div>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Timeline Summary</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={stats.total} />
          <Stat label="Planned" value={stats.planned} />
          <Stat label="Confirmed" value={stats.confirmed} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Delayed" value={stats.delayed} />
          <Stat label="Cancelled" value={stats.cancelled} />
          <Stat label="First" value={stats.first ? stats.first.title : "—"} />
          <Stat label="Last" value={stats.last ? stats.last.title : "—"} />
          <Stat
            label="Schedule span"
            value={stats.spanStart && stats.spanEnd ? `${stats.spanStart} – ${stats.spanEnd}` : "—"}
          />
        </dl>
      </Card>

      {schedule.length > 0 ? (
        <Card>
          <ScheduleFilters value={filters} onChange={setFilters} assignedOptions={assignedOptions} />
        </Card>
      ) : null}

      {reorderError ? (
        <p role="alert" className="text-sm text-danger">
          {reorderError}
        </p>
      ) : null}

      {schedule.length === 0 ? (
        <EmptyState
          title="No schedule items yet"
          description="Add the first item to start building this event's day-of timeline."
          action={!readOnly ? <Button onClick={() => setModal({ kind: "create" })}>Add Schedule Item</Button> : undefined}
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState title="No items match your filters" description="Try adjusting or clearing the filters above." />
      ) : (
        <div className="space-y-2" data-testid="schedule-item-list">
          {!readOnly ? (
            <p className="text-xs text-text-muted">
              Sorted by start time. Reordering only changes items that share a time or have none set.
            </p>
          ) : null}
          {visibleItems.map((item) => {
            const chronoIndex = chronological.findIndex((i) => i.id === item.id);
            const prev = chronological[chronoIndex - 1];
            const next = chronological[chronoIndex + 1];
            return (
              <ScheduleItemRow
                key={item.id}
                item={item}
                sortPosition={chronoIndex + 1}
                readOnly={readOnly}
                canMoveUp={chronoIndex > 0 && prev.start_time === item.start_time}
                canMoveDown={chronoIndex < chronological.length - 1 && next.start_time === item.start_time}
                onMoveUp={() => moveItem(item.id, "up")}
                onMoveDown={() => moveItem(item.id, "down")}
                onEdit={() => setModal({ kind: "edit", item })}
                onDelete={() => setModal({ kind: "delete", item })}
                onChanged={refetch}
              />
            );
          })}
        </div>
      )}

      <ScheduleItemForm
        key={modal?.kind === "edit" ? modal.item.id : modal?.kind === "create" ? "create" : "closed"}
        eventId={eventId}
        item={modal?.kind === "edit" ? modal.item : null}
        open={modal?.kind === "create" || modal?.kind === "edit"}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null);
          refetch();
        }}
      />

      {modal?.kind === "delete" ? (
        <ConfirmDeleteScheduleItemModal
          open
          onClose={() => setModal(null)}
          itemId={modal.item.id}
          itemTitle={modal.item.title}
          onDeleted={refetch}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="text-sm font-medium text-text">{value}</dd>
    </div>
  );
}
