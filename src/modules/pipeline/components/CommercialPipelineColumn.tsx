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
}

export function CommercialPipelineColumn({ column, leads, buildActions }: CommercialPipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const value = columnPipelineValue(leads);

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-md border ${
        isOver ? "border-accent bg-accent/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
        <div>
          <p className="font-serif text-sm font-semibold text-text">{column.label}</p>
          <p className="text-xs text-text-muted">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
            {value > 0 ? ` · $${value.toLocaleString()}` : ""}
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
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
