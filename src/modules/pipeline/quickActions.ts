import type { Lead } from "@/types/lead";
import type { Permission } from "@/core/enums/permission";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";

export interface QuickActionHandlers {
  can: (permission: Permission) => boolean;
  onOpen: () => void;
  onAssignTeam: () => void;
  onScheduleConsultation: () => void;
  onSendProposal: () => void;
  onMoveToWaitingDecision: () => void;
  onMarkLost: () => void;
  onArchive: () => void;
  onBookLead: () => void;
}

/**
 * Shared by desktop cards and the mobile list — same handlers, same
 * permission checks, so an action available in one place is available
 * (or unavailable) identically in the other. Every action is included only
 * when it's both a valid transition for the Lead's current status and
 * permission-allowed — never a disabled/no-op placeholder.
 */
export function buildQuickActions(lead: Lead, handlers: QuickActionHandlers): ActionMenuAction[] {
  const actions: ActionMenuAction[] = [{ label: "Open Lead", onSelect: handlers.onOpen }];

  const isTerminal = lead.status === "converted" || lead.status === "lost" || lead.status === "archived";
  if (isTerminal) return actions;

  if (handlers.can("leads.update")) {
    actions.push({ label: "Assign Team", onSelect: handlers.onAssignTeam });
    if (lead.status !== "consultation_scheduled") {
      actions.push({ label: "Schedule Consultation", onSelect: handlers.onScheduleConsultation });
    }
    if (lead.status !== "proposal_sent") {
      actions.push({ label: "Send Proposal", onSelect: handlers.onSendProposal });
    }
    if (lead.status !== "waiting_decision") {
      actions.push({ label: "Move to Waiting Decision", onSelect: handlers.onMoveToWaitingDecision });
    }
    actions.push({ label: "Mark Lost", onSelect: handlers.onMarkLost, destructive: true });
  }

  if (handlers.can("leads.archive")) {
    actions.push({ label: "Archive", onSelect: handlers.onArchive, destructive: true });
  }

  if (handlers.can("leads.update") && handlers.can("events.create")) {
    actions.push({ label: "Book Lead", onSelect: handlers.onBookLead });
  }

  return actions;
}
