"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import { OperationalPipelineCard } from "@/modules/pipeline/components/OperationalPipelineCard";
import type { OperationalColumnDefinition } from "@/modules/pipeline/operationalConstants";
import type { OperationalCardData } from "@/modules/pipeline/operationalLogic";

interface OperationalPipelineColumnProps {
  column: OperationalColumnDefinition;
  cards: OperationalCardData[];
  buildActions: (data: OperationalCardData) => ActionMenuAction[];
  canUpdate: boolean;
}

export function OperationalPipelineColumn({ column, cards, buildActions, canUpdate }: OperationalPipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

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
            {cards.length} {cards.length === 1 ? "event" : "events"}
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {cards.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-text/45">No events in this stage</p>
        ) : (
          cards.map((data) => (
            <OperationalPipelineCard key={data.event.id} data={data} actions={buildActions(data)} canUpdate={canUpdate} />
          ))
        )}
      </div>
    </div>
  );
}
