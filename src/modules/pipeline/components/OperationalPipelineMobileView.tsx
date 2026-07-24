"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import { OperationalPipelineCard } from "@/modules/pipeline/components/OperationalPipelineCard";
import { OPERATIONAL_COLUMNS } from "@/modules/pipeline/operationalConstants";
import type { OperationalBoardColumns, OperationalCardData } from "@/modules/pipeline/operationalLogic";
import type { EventLifecycleStage } from "@/core/enums/eventLifecycleStage";

interface OperationalPipelineMobileViewProps {
  columns: OperationalBoardColumns;
  buildActions: (data: OperationalCardData) => ActionMenuAction[];
  canUpdate: boolean;
}

/**
 * Single-stage view, not the desktop multi-column board — no pointer drag on
 * touch, matching CommercialPipelineMobileView's own rule. Moving an Event
 * between stages happens through its card's own action menu (the same
 * buildActions the desktop cards use); the stage selector below only chooses
 * which stage's Events to look at.
 */
export function OperationalPipelineMobileView({ columns, buildActions, canUpdate }: OperationalPipelineMobileViewProps) {
  const [activeColumn, setActiveColumn] = useState<EventLifecycleStage>(OPERATIONAL_COLUMNS[0].id);
  const cards = columns[activeColumn];

  return (
    <div className="md:hidden">
      <Select
        aria-label="Select pipeline stage"
        value={activeColumn}
        onChange={(event) => setActiveColumn(event.target.value as EventLifecycleStage)}
        className="mb-3"
      >
        {OPERATIONAL_COLUMNS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label} ({columns[c.id].length})
          </option>
        ))}
      </Select>

      {cards.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-xs text-text/45">
          No events in this stage
        </p>
      ) : (
        <div className="space-y-3">
          {cards.map((data) => (
            <OperationalPipelineCard key={data.event.id} data={data} actions={buildActions(data)} draggable={false} canUpdate={canUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
