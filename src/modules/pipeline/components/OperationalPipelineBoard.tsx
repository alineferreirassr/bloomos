"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";
import { getEvents, getClients, getChecklistByEventId, getScheduleByEventId, getEventNextAction, updateEventLifecycleStage } from "@/lib/data";
import type { Event } from "@/types/event";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import { getEventHealthStatus } from "@/core/workflows/eventHealth";
import { getNextLifecycleStages, isLifecycleStageTerminal, isEventTerminal } from "@/core/workflows/eventWorkflow";
import { isChecklistItemOverdue } from "@/modules/events/checklistStats";
import { EVENT_LIFECYCLE_STAGE_LABELS, type EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import { OPERATIONAL_COLUMNS } from "@/modules/pipeline/operationalConstants";
import {
  EMPTY_OPERATIONAL_FILTERS,
  collectOwners,
  filterOperationalCards,
  getDaysUntilEventDate,
  groupCardsByColumn,
  type OperationalCardData,
  type OperationalPipelineFilterValues,
} from "@/modules/pipeline/operationalLogic";
import { OperationalPipelineColumn } from "@/modules/pipeline/components/OperationalPipelineColumn";
import { OperationalPipelineFilters } from "@/modules/pipeline/components/OperationalPipelineFilters";
import { OperationalPipelineMobileView } from "@/modules/pipeline/components/OperationalPipelineMobileView";

type LoadState = { status: "loading" } | { status: "error" } | { status: "ready"; cards: OperationalCardData[] };

/**
 * Aggregates each non-archived Event with its Client, checklist/schedule
 * stats, next recommended action, and Health Status — one Promise.all per
 * Event, same N+1-but-accepted shape EventsListView's own loader already
 * uses for the /events list page. No new repository method, no new RPC:
 * every piece here already exists on the Events repository/workflow layer.
 */
async function loadBoardCards(): Promise<LoadState> {
  try {
    const [events, clients] = await Promise.all([
      getEvents({ includeArchived: false }),
      getClients({ includeArchived: true }),
    ]);
    const clientsById = new Map(clients.map((client) => [client.id, client]));

    const cards = await Promise.all(
      events.map(async (event): Promise<OperationalCardData> => {
        const [checklist, schedule, nextAction] = await Promise.all([
          getChecklistByEventId(event.id),
          getScheduleByEventId(event.id),
          getEventNextAction(event.id),
        ]);
        const checklistCompleted = checklist.filter((item) => item.status === "completed").length;
        const checklistOverdue = checklist.filter((item) => isChecklistItemOverdue(item)).length;
        const daysUntilEvent = getDaysUntilEventDate(event.event_date);
        const healthStatus = getEventHealthStatus(
          {
            status: event.status,
            priority: event.priority,
            location_name: event.location_name,
            address: event.address,
            budget_min: event.budget_min,
            budget_max: event.budget_max,
          },
          {
            hasChecklistItems: checklist.length > 0,
            hasOverdueChecklistItems: checklistOverdue > 0,
            hasScheduleItems: schedule.length > 0,
            hasPostEventReview: false,
            daysUntilEvent,
          },
        );

        return {
          event,
          client: clientsById.get(event.client_id),
          checklistTotal: checklist.length,
          checklistCompleted,
          checklistOverdue,
          scheduleTotal: schedule.length,
          scheduleCompleted: schedule.filter((item) => item.status === "completed").length,
          nextAction,
          healthStatus,
          daysUntilEvent,
        };
      }),
    );

    return { status: "ready", cards };
  } catch {
    return { status: "error" };
  }
}

export function OperationalPipelineBoard() {
  const { can } = useMemberSession();
  const canUpdate = can("events.update");
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [filters, setFilters] = useState<OperationalPipelineFilterValues>(EMPTY_OPERATIONAL_FILTERS);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [movingEventIds, setMovingEventIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const load = () => {
    setLoadState({ status: "loading" });
    loadBoardCards().then(setLoadState);
  };

  useEffect(() => {
    let cancelled = false;
    loadBoardCards().then((next) => {
      if (!cancelled) setLoadState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = useMemo(() => (loadState.status === "ready" ? loadState.cards : []), [loadState]);
  const owners = useMemo(() => collectOwners(cards), [cards]);
  const filteredCards = useMemo(() => filterOperationalCards(cards, filters), [cards, filters]);
  const columns = useMemo(() => groupCardsByColumn(filteredCards), [filteredCards]);

  function patchEvent(updated: Event) {
    setLoadState((current) => {
      if (current.status !== "ready") return current;
      return { status: "ready", cards: current.cards.map((c) => (c.event.id === updated.id ? { ...c, event: updated } : c)) };
    });
  }

  async function moveEventToStage(event: Event, targetStage: EventLifecycleStage) {
    if (event.lifecycle_stage === targetStage) return;
    if (movingEventIds.has(event.id)) return;

    const previous = event;
    setMovingEventIds((current) => new Set(current).add(event.id));
    patchEvent({ ...event, lifecycle_stage: targetStage });
    setBoardError(null);
    try {
      const result = await updateEventLifecycleStage(event.id, targetStage);
      if (!result.success) {
        patchEvent(previous);
        setBoardError(result.error);
        return;
      }
      patchEvent(result.data);
    } catch (err) {
      patchEvent(previous);
      setBoardError(err instanceof Error ? err.message : "Could not update this event's stage. Please try again.");
    } finally {
      setMovingEventIds((current) => {
        const next = new Set(current);
        next.delete(event.id);
        return next;
      });
    }
  }

  function handleDragEnd(dragEvent: DragEndEvent) {
    const { active, over } = dragEvent;
    if (!over) return;
    const card = cards.find((c) => c.event.id === active.id);
    if (!card) return;
    moveEventToStage(card.event, over.id as EventLifecycleStage);
  }

  function buildActionsFor(data: OperationalCardData): ActionMenuAction[] {
    const actions: ActionMenuAction[] = [
      { label: "Open Event", onSelect: () => window.open(`/events/${data.event.id}`, "_self") },
    ];

    const isLocked = isLifecycleStageTerminal(data.event.lifecycle_stage) || isEventTerminal(data.event.status);
    if (isLocked || !canUpdate || movingEventIds.has(data.event.id)) return actions;

    for (const stage of getNextLifecycleStages(data.event.lifecycle_stage)) {
      actions.push({
        label: `Move to ${EVENT_LIFECYCLE_STAGE_LABELS[stage]}`,
        onSelect: () => moveEventToStage(data.event, stage),
      });
    }
    return actions;
  }

  if (loadState.status === "loading") {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-9 w-full" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-72" />
          ))}
        </div>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="p-4">
        <ErrorState message="Could not load the Operational Pipeline." onRetry={load} />
      </div>
    );
  }

  const isBoardEmpty = cards.length === 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <h1 className="font-serif text-xl font-semibold text-text">Operational Pipeline</h1>
        <p className="text-sm text-text-muted">
          Every active Event, grouped by its current lifecycle stage. Drag a card (or use its menu) to advance it.
        </p>
      </div>

      {boardError ? (
        <p role="alert" className="rounded-md border border-danger/60 bg-danger/10 px-4 py-2 text-sm text-danger">
          {boardError}
        </p>
      ) : null}

      {isBoardEmpty ? (
        <EmptyState
          title="No active events"
          description="Events will appear here as they're created or booked from the Commercial Pipeline."
        />
      ) : (
        <>
          <OperationalPipelineFilters value={filters} onChange={setFilters} owners={owners} />

          <div className="hidden md:block" data-testid="operational-pipeline-desktop">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {OPERATIONAL_COLUMNS.map((column) => (
                  <OperationalPipelineColumn
                    key={column.id}
                    column={column}
                    cards={columns[column.id]}
                    buildActions={buildActionsFor}
                    canUpdate={canUpdate}
                  />
                ))}
              </div>
            </DndContext>
          </div>

          <OperationalPipelineMobileView columns={columns} buildActions={buildActionsFor} canUpdate={canUpdate} />
        </>
      )}
    </div>
  );
}
