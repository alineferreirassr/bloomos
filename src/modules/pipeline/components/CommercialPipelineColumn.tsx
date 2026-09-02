"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import { CommercialPipelineCard } from "@/modules/pipeline/components/CommercialPipelineCard";
import { columnPipelineValue } from "@/modules/pipeline/logic";
import type { CommercialColumnDefinition } from "@/modules/pipeline/constants";
import type { Lead } from "@/types/lead";

interface CommercialPipelineColumnProps {
  column: CommercialColumnDefinition;
  leads: Lead[];
  buildActions: (lead: Lead) => ActionMenuAction[];
  /** Checkpoint 19.2 — entrance-animation classes (e.g. "animate-fade-up stagger-2") applied by the board so columns cascade in sequence. */
  className?: string;
}

/* Relationships/CRM visual pass — quiet shadow-only surface (no hairline
   border) matching the rest of the redesign; the drop-target highlight
   moves from a hard accent border to a soft rose tint + ring so it still
   reads clearly without looking like an error/alert state. Column/card
   interaction model (dnd-kit) is completely unchanged. */
export function CommercialPipelineColumn({ column, leads, buildActions, className }: CommercialPipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const value = columnPipelineValue(leads);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-2xl bg-surface shadow-luxury-sm transition-shadow duration-150 ${
        isOver ? "ring-2 ring-accent/40 ring-inset" : ""
      }${className ? ` ${className}` : ""}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3.5">
        <div>
          <p className="font-serif text-sm font-semibold text-text">{column.label}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
            {value > 0 ? ` · $${value.toLocaleString()}` : ""}
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-3">
        {leads.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-text/45">No leads in this stage</p>
        ) : (
          leads.map((lead) => (
            <CommercialPipelineCard key={lead.id} lead={lead} actions={buildActions(lead)} />
          ))
        )}
      </div>
    </div>
  );
}
