"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { LuxuryCard } from "@/modules/dashboard/luxury/components/LuxuryCard";
import { Badge } from "@/components/ui/Badge";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { EventPriorityBadge } from "@/modules/events/components/EventPriorityBadge";
import { OperationalHealthBadge } from "@/modules/pipeline/components/OperationalHealthBadge";
import { formatEventDate } from "@/modules/events/dateFormat";
import { isEventTerminal } from "@/core/workflows/eventWorkflow";
import { isLifecycleStageTerminal } from "@/core/workflows/eventWorkflow";
import type { OperationalCardData } from "@/modules/pipeline/operationalLogic";
import { getFullName } from "@/lib/personName";

interface OperationalPipelineCardProps {
  data: OperationalCardData;
  actions: ActionMenuAction[];
  /** false on mobile — dragging is desktop-only, matching CommercialPipelineCard's own mobile rule. */
  draggable?: boolean;
  /** Mirrors the `events.update` gate `buildActionsFor` already applies to the ActionMenu — without it, a view-only member could drag a card even though its menu correctly hides every "Move to" option. */
  canUpdate: boolean;
}

export function OperationalPipelineCard({ data, actions, draggable = true, canUpdate }: OperationalPipelineCardProps) {
  const { event, client, checklistTotal, checklistCompleted, checklistOverdue, nextAction, healthStatus, daysUntilEvent } = data;

  // A closed lifecycle stage can't be left (isLifecycleStageTerminal), and a
  // completed/cancelled/archived Event's status is also locked — either one
  // means this card shouldn't be draggable, matching EventLifecycleSelect's
  // own rule that a terminal stage/status only ever renders as plain text.
  const isLocked = isLifecycleStageTerminal(event.lifecycle_stage) || isEventTerminal(event.status);
  const canDrag = draggable && !isLocked && canUpdate;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: event.id,
    disabled: !canDrag,
  });

  const clientName = client ? getFullName(client) : "Unknown client";
  const isOverdue = daysUntilEvent !== null && daysUntilEvent < 0;
  const isUpcoming = daysUntilEvent !== null && daysUntilEvent >= 0 && daysUntilEvent <= 7;

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={isDragging ? "opacity-50" : undefined}
    >
      <LuxuryCard className="transition-transform duration-150 hover:-translate-y-0.5">
        <div className="flex items-start justify-between gap-2">
          <div
            {...(canDrag ? { ...attributes, ...listeners } : {})}
            role={canDrag ? "button" : undefined}
            tabIndex={canDrag ? 0 : undefined}
            aria-label={canDrag ? `Drag ${event.title}'s card` : undefined}
            className={canDrag ? "cursor-grab touch-none active:cursor-grabbing" : undefined}
          >
            <p className="font-medium tracking-tight text-text">{event.title}</p>
            <p className="text-xs text-text-muted">{clientName}</p>
          </div>
          <ActionMenu actions={actions} />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <EventPriorityBadge priority={event.priority} />
          <OperationalHealthBadge status={healthStatus} />
          {isOverdue ? (
            <Badge tone="danger">Overdue</Badge>
          ) : isUpcoming ? (
            <Badge tone="neutral">{daysUntilEvent === 0 ? "Today" : `In ${daysUntilEvent}d`}</Badge>
          ) : null}
        </div>

        <div className="mt-3 space-y-1 text-xs text-text-muted">
          <p>{event.event_date ? formatEventDate(event.event_date) : "No date set"}</p>
          <p>
            Checklist: {checklistCompleted}/{checklistTotal}
            {checklistOverdue > 0 ? ` · ${checklistOverdue} overdue` : ""}
          </p>
          <p>{event.assigned_owner ? `Owner: ${event.assigned_owner}` : "Unassigned"}</p>
        </div>

        {nextAction ? (
          <p className="mt-3 border-t border-border/60 pt-2 text-xs font-medium text-accent">{nextAction}</p>
        ) : null}
      </LuxuryCard>
    </div>
  );
}
