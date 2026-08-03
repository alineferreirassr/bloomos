"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import { CommercialPipelineCard } from "@/modules/pipeline/components/CommercialPipelineCard";
import { COMMERCIAL_COLUMNS, type CommercialColumnId } from "@/modules/pipeline/constants";
import type { CommercialBoardColumns } from "@/modules/pipeline/logic";
import type { Lead } from "@/types/lead";

interface CommercialPipelineMobileViewProps {
  columns: CommercialBoardColumns;
  buildActions: (lead: Lead) => ActionMenuAction[];
}

/**
 * Single-stage view, not the desktop multi-column board — no pointer drag on
 * touch. Moving a Lead between stages happens through its Quick Actions menu
 * (the same buildActions the desktop cards use), the stage selector below is
 * only for choosing which stage's Leads to look at.
 */
export function CommercialPipelineMobileView({ columns, buildActions }: CommercialPipelineMobileViewProps) {
  const [activeColumn, setActiveColumn] = useState<CommercialColumnId>("lead");
  const leads = columns[activeColumn];
  const column = COMMERCIAL_COLUMNS.find((c) => c.id === activeColumn);

  return (
    <div className="md:hidden">
      <Select
        aria-label="Select pipeline stage"
        value={activeColumn}
        onChange={(event) => setActiveColumn(event.target.value as CommercialColumnId)}
        className="mb-3"
      >
        {COMMERCIAL_COLUMNS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label} ({columns[c.id].length})
          </option>
        ))}
      </Select>

      {column?.id === "booked" ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-xs text-text/45">
          Booked Leads leave the pipeline immediately — use a Lead&apos;s Book Lead Quick Action to book it.
        </p>
      ) : leads.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-xs text-text/45">
          No leads in this stage
        </p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <CommercialPipelineCard key={lead.id} lead={lead} actions={buildActions(lead)} draggable={false} />
          ))}
        </div>
      )}
    </div>
  );
}
