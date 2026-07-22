"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/Card";
import { ActionMenu } from "@/components/ui/ActionMenu";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import { LeadStatusBadge } from "@/modules/leads/components/LeadStatusBadge";
import { DueStateBadge } from "@/modules/pipeline/components/DueStateBadge";
import { getNextRecommendedAction } from "@/core/workflows/leadWorkflow";
import { getDueState } from "@/core/workflows/dueState";
import type { Lead } from "@/types/lead";

interface CommercialPipelineCardProps {
  lead: Lead;
  actions: ActionMenuAction[];
  /** false on mobile — dragging is desktop-only, per the Mobile UX requirement not to force pointer drag onto touch. */
  draggable?: boolean;
}

export function CommercialPipelineCard({ lead, actions, draggable = true }: CommercialPipelineCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    disabled: !draggable,
  });

  const nextAction = getNextRecommendedAction(lead);
  const dueState = getDueState(lead.event_date);
  const budget =
    lead.budget_min !== null || lead.budget_max !== null
      ? formatBudgetRange(lead.budget_min, lead.budget_max)
      : null;

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: CSS.Translate.toString(transform) } : undefined}
      className={isDragging ? "opacity-50" : undefined}
    >
      <Card className="transition-colors duration-150 hover:border-accent/50">
        <div className="flex items-start justify-between gap-2">
          <div
            {...(draggable ? { ...attributes, ...listeners } : {})}
            role={draggable ? "button" : undefined}
            tabIndex={draggable ? 0 : undefined}
            aria-label={draggable ? `Drag ${lead.first_name} ${lead.last_name}'s card` : undefined}
            className={draggable ? "cursor-grab touch-none active:cursor-grabbing" : undefined}
          >
            <p className="font-medium tracking-tight text-text">
              {lead.first_name} {lead.last_name}
            </p>
          </div>
          <ActionMenu actions={actions} />
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <LeadStatusBadge status={lead.status} />
          <DueStateBadge dueState={dueState} />
        </div>

        <div className="mt-3 space-y-1 text-xs text-text-muted">
          {lead.event_type ? <p>{lead.event_type}</p> : null}
          {budget ? <p>{budget}</p> : null}
          {lead.assigned_to ? <p>Assigned to {lead.assigned_to}</p> : <p>Unassigned</p>}
        </div>

        {nextAction ? (
          <p className="mt-3 border-t border-border pt-2 text-xs font-medium text-accent">{nextAction}</p>
        ) : null}

        <p className="mt-2 text-[11px] text-text-muted/70">
          Created {new Date(lead.created_at).toLocaleDateString()}
        </p>
      </Card>
    </div>
  );
}

function formatBudgetRange(min: number | null, max: number | null): string {
  const format = (n: number) => `$${n.toLocaleString()}`;
  if (min !== null && max !== null) return `${format(min)}–${format(max)}`;
  if (max !== null) return `Up to ${format(max)}`;
  if (min !== null) return `From ${format(min)}`;
  return "";
}
