import {
  LEAD_STATUSES,
  LOCKED_LEAD_STATUSES,
  WORKING_LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  type LeadStatus,
} from "@/core/enums/leadStatus";

/**
 * The canonical Lead lifecycle. This is the single source of truth for which
 * statuses exist and which transitions between them are legal — the data
 * layer (lib/data/index.ts) and the UI (LeadStatusSelect, LeadDetailView)
 * both consume this file rather than each encoding their own copy of the rule.
 */
export { LEAD_STATUSES, LOCKED_LEAD_STATUSES, WORKING_LEAD_STATUSES, LEAD_STATUS_LABELS };
export type { LeadStatus };

/**
 * True for a status reachable only through its own dedicated action
 * (Archive, Convert to Client) — never the plain status selector, and never
 * left once entered.
 */
export function isTerminalStatus(status: LeadStatus): boolean {
  return LOCKED_LEAD_STATUSES.includes(status);
}

/**
 * The authoritative transition rule: `converted` and `archived` are
 * terminal; any other status can move freely to any other non-terminal
 * status, so the team can correct a status by hand without fighting the
 * funnel order.
 */
export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  if (isTerminalStatus(from)) return false;
  if (from === to) return false;
  return WORKING_LEAD_STATUSES.includes(to);
}

/** Every status `from` can legally move to right now (empty once terminal). */
export function getNextStatuses(from: LeadStatus): LeadStatus[] {
  if (isTerminalStatus(from)) return [];
  return WORKING_LEAD_STATUSES.filter((status) => canTransition(from, status));
}

interface LeadForNextAction {
  status: LeadStatus;
}

/** Short, human-readable suggestion for what to do next with this lead. */
export function getNextRecommendedAction(lead: LeadForNextAction): string | null {
  switch (lead.status) {
    case "new":
      return "Reach out to this lead";
    case "contacted":
      return "Send the Welcome Guide";
    case "welcome_guide_sent":
      return "Schedule a consultation";
    case "consultation_scheduled":
      return "Mark as qualified after the consultation";
    case "qualified":
      return "Send a proposal";
    case "proposal_sent":
      return "Follow up on the proposal, or convert to Client";
    case "converted":
    case "lost":
    case "archived":
      return null;
    default:
      return null;
  }
}
