"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getChecklistByEventId, getClientById, getEventById, reorderChecklistItems } from "@/lib/data";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { ChecklistItem } from "@/types/checklistItem";
import type { ChecklistCategory } from "@/core/enums/checklistCategory";
import { CHECKLIST_CATEGORIES } from "@/core/enums/checklistCategory";
import { NotFoundError } from "@/core/errors";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventStatusBadge } from "@/modules/events/components/EventStatusBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import { computeChecklistStats, isChecklistItemOverdue } from "@/modules/events/checklistStats";
import { ChecklistFilters, DEFAULT_CHECKLIST_FILTERS, type ChecklistFiltersValue } from "@/modules/events/components/ChecklistFilters";
import { ChecklistGroup } from "@/modules/events/components/ChecklistGroup";
import { ChecklistItemRow } from "@/modules/events/components/ChecklistItemRow";
import { ChecklistItemForm } from "@/modules/events/components/ChecklistItemForm";
import { ConfirmDeleteChecklistItemModal } from "@/modules/events/components/ConfirmDeleteChecklistItemModal";
import { getFullName } from "@/lib/personName";

type LoadState =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error" }
  | { status: "ready"; event: Event; client: Client | null; checklist: ChecklistItem[] };

async function loadChecklist(eventId: string): Promise<LoadState> {
  try {
    const event = await getEventById(eventId);
    const [client, checklist] = await Promise.all([
      getClientById(event.client_id).catch(() => null),
      getChecklistByEventId(eventId),
    ]);
    return { status: "ready", event, client, checklist: [...checklist].sort((a, b) => a.sort_order - b.sort_order) };
  } catch (err) {
    return { status: err instanceof NotFoundError ? "not-found" : "error" };
  }
}

function matchesFilters(item: ChecklistItem, filters: ChecklistFiltersValue): boolean {
  if (!filters.showCompleted && item.status === "completed") return false;
  if (filters.category !== "all" && item.category !== filters.category) return false;
  if (filters.status !== "all" && item.status !== filters.status) return false;
  if (filters.priority !== "all" && item.priority !== filters.priority) return false;
  if (filters.assignedType !== "all" && item.assigned_type !== filters.assignedType) return false;
  if (filters.overdueOnly && !isChecklistItemOverdue(item)) return false;
  if (filters.search.trim() !== "") {
    const needle = filters.search.trim().toLowerCase();
    const haystack = `${item.title} ${item.description ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

type ModalState = { kind: "create" } | { kind: "edit"; item: ChecklistItem } | { kind: "delete"; item: ChecklistItem } | null;

export function EventChecklistView({ eventId }: { eventId: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filters, setFilters] = useState<ChecklistFiltersValue>(DEFAULT_CHECKLIST_FILTERS);
  const [modal, setModal] = useState<ModalState>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadChecklist(eventId).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const refetch = () => {
    loadChecklist(eventId).then(setState);
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
    return <ErrorState message="Could not load this checklist." onRetry={refetch} />;
  }

  const { event, client, checklist } = state;
  const readOnly = event.status === "archived" || event.status === "cancelled";
  const stats = computeChecklistStats(checklist);

  const sortPositionById = new Map(checklist.map((item, index) => [item.id, index + 1]));
  const visibleItems = checklist.filter((item) => matchesFilters(item, filters));

  const moveItem = async (itemId: string, direction: "up" | "down") => {
    setReorderError(null);
    const index = checklist.findIndex((item) => item.id === itemId);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= checklist.length) return;

    const reordered = [...checklist];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    try {
      const result = await reorderChecklistItems(eventId, reordered.map((item) => item.id));
      if (!result.success) {
        setReorderError(result.error);
        return;
      }
      refetch();
    } catch (err) {
      setReorderError(err instanceof Error ? err.message : "Could not reorder the checklist. Please try again.");
    }
  };

  const renderRow = (item: ChecklistItem) => (
    <ChecklistItemRow
      key={item.id}
      item={item}
      sortPosition={sortPositionById.get(item.id) ?? 0}
      readOnly={readOnly}
      canMoveUp={(sortPositionById.get(item.id) ?? 0) > 1}
      canMoveDown={(sortPositionById.get(item.id) ?? 0) < checklist.length}
      onMoveUp={() => moveItem(item.id, "up")}
      onMoveDown={() => moveItem(item.id, "down")}
      onEdit={() => setModal({ kind: "edit", item })}
      onDelete={() => setModal({ kind: "delete", item })}
      onChanged={refetch}
    />
  );

  const groupedCategories: { category: ChecklistCategory; items: ChecklistItem[] }[] = filters.groupByCategory
    ? CHECKLIST_CATEGORIES.map((category) => ({
        category,
        items: visibleItems.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0)
    : [];

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/events/${event.id}`} className="text-sm text-accent hover:underline">
          ← Back to {event.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-3xl font-semibold text-text">Checklist</h2>
          <EventStatusBadge status={event.status} />
        </div>
        <p className="mt-1 text-sm text-text-muted">
          {event.title}
          {client ? ` · ${getFullName(client)}` : ""}
          {event.event_date ? ` · ${formatEventDate(event.event_date)}` : ""}
          {" · "}
          {stats.completed}/{stats.total} complete
          {stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ""}
        </p>

        {!readOnly ? (
          <div className="mt-4">
            <Button onClick={() => setModal({ kind: "create" })}>Add Checklist Item</Button>
          </div>
        ) : (
          <p className="mt-4 text-sm text-text-muted">
            This event is {event.status} — the checklist is read-only.
          </p>
        )}
      </div>

      <LuxuryCard>
        <h3 className="font-serif text-[17px] font-semibold text-text">Progress Summary</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total" value={stats.total} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Pending" value={stats.pending} />
          <Stat label="In progress" value={stats.inProgress} />
          <Stat label="Blocked" value={stats.blocked} />
          <Stat label="Cancelled" value={stats.cancelled} />
          <Stat label="Overdue" value={stats.overdue} />
          <Stat label="Complete" value={`${stats.percentComplete}%`} />
        </dl>
      </LuxuryCard>

      {checklist.length > 0 ? (
        <div className="rounded-2xl bg-surface/70 p-4">
          <ChecklistFilters value={filters} onChange={setFilters} />
        </div>
      ) : null}

      {reorderError ? (
        <p role="alert" className="text-sm text-danger">
          {reorderError}
        </p>
      ) : null}

      {checklist.length === 0 ? (
        <EmptyState
          title="No checklist items yet"
          description="Add the first item to start tracking preparation for this event."
          action={!readOnly ? <Button onClick={() => setModal({ kind: "create" })}>Add Checklist Item</Button> : undefined}
        />
      ) : visibleItems.length === 0 ? (
        <EmptyState title="No items match your filters" description="Try adjusting or clearing the filters above." />
      ) : filters.groupByCategory ? (
        <div className="space-y-3">
          {groupedCategories.map((group) => (
            <ChecklistGroup key={group.category} category={group.category} items={group.items} renderRow={renderRow} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">{visibleItems.map(renderRow)}</div>
      )}

      <ChecklistItemForm
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
        <ConfirmDeleteChecklistItemModal
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
