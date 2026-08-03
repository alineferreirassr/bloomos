import type { LeadStatus } from "@/core/enums/leadStatus";

/**
 * The Commercial Pipeline is a Kanban view over Lead.status — no new schema,
 * no new status. "Booked" is a virtual column: it never corresponds to a
 * persisted Lead status (a Lead becomes `converted` and leaves this board
 * entirely once bookLead() succeeds), it only exists as a drop target that
 * triggers the booking confirmation flow.
 */
export type CommercialColumnId =
  | "lead"
  | "qualified"
  | "consultation_scheduled"
  | "proposal_sent"
  | "waiting_decision"
  | "booked";

export interface CommercialColumnDefinition {
  id: CommercialColumnId;
  label: string;
  /** Every Lead.status bucketed into this column. Empty for "booked" — it's a virtual, action-only column. */
  statuses: LeadStatus[];
  /**
   * The status a Lead is set to when dropped into this column from
   * elsewhere. For a column mapping more than one status (only "lead"
   * today), this is the single representative status used on drag-in —
   * the other statuses in the group stay reachable only via Quick Actions
   * or by a Lead already being there.
   */
  defaultStatus: LeadStatus | null;
}

export const COMMERCIAL_COLUMNS: CommercialColumnDefinition[] = [
  { id: "lead", label: "Lead", statuses: ["new", "contacted", "welcome_guide_sent"], defaultStatus: "new" },
  { id: "qualified", label: "Qualified", statuses: ["qualified"], defaultStatus: "qualified" },
  {
    id: "consultation_scheduled",
    label: "Consultation Scheduled",
    statuses: ["consultation_scheduled"],
    defaultStatus: "consultation_scheduled",
  },
  { id: "proposal_sent", label: "Proposal Sent", statuses: ["proposal_sent"], defaultStatus: "proposal_sent" },
  {
    id: "waiting_decision",
    label: "Waiting Decision",
    statuses: ["waiting_decision"],
    defaultStatus: "waiting_decision",
  },
  { id: "booked", label: "Booked", statuses: [], defaultStatus: null },
];

/** Statuses that keep a Lead visible on the Commercial Pipeline board at all. */
export const COMMERCIAL_PIPELINE_STATUSES: LeadStatus[] = COMMERCIAL_COLUMNS.flatMap((c) => c.statuses);

export function columnForStatus(status: LeadStatus): CommercialColumnId | null {
  const column = COMMERCIAL_COLUMNS.find((c) => c.statuses.includes(status));
  return column ? column.id : null;
}

export function columnById(id: CommercialColumnId): CommercialColumnDefinition {
  const column = COMMERCIAL_COLUMNS.find((c) => c.id === id);
  if (!column) throw new Error(`Unknown Commercial Pipeline column: ${id}`);
  return column;
}
