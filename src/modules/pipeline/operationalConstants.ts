import { EVENT_LIFECYCLE_STAGES, EVENT_LIFECYCLE_STAGE_LABELS, type EventLifecycleStage } from "@/core/enums/eventLifecycleStage";

/**
 * The Operational Pipeline is a Kanban view over Event.lifecycle_stage — no
 * new schema, no new stage field, no second state machine. Unlike the
 * Commercial Pipeline (which buckets several Lead.status values into fewer
 * columns), lifecycle_stage already has exactly the right granularity for
 * a board column, so this is a direct 1:1 mapping — one column per stage,
 * in the same order eventWorkflow.ts already treats as canonical.
 *
 * "closed" is included as a real column (not excluded like Commercial
 * Pipeline's terminal Lead statuses) — an Event reaching closed is still
 * useful to see on the board as "wrapped up," not something that should
 * vanish. Archived Events are excluded separately, by workspace-standard
 * archived_at filtering at the data-loading layer, not by this column model.
 */
export interface OperationalColumnDefinition {
  id: EventLifecycleStage;
  label: string;
}

export const OPERATIONAL_COLUMNS: OperationalColumnDefinition[] = EVENT_LIFECYCLE_STAGES.map((stage) => ({
  id: stage,
  label: EVENT_LIFECYCLE_STAGE_LABELS[stage],
}));

export function columnById(id: EventLifecycleStage): OperationalColumnDefinition {
  const column = OPERATIONAL_COLUMNS.find((c) => c.id === id);
  if (!column) throw new Error(`Unknown Operational Pipeline column: ${id}`);
  return column;
}
