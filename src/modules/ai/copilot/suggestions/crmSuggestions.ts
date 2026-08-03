import { getLeads } from "@/lib/data";
import type { SuggestionProvider, CopilotSuggestion } from "@/core/ai/copilot/suggestionEngine";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checkpoint 20, Step 7 — CRM suggestions: Follow Up, Proposal, Reminder,
 * Meeting. Computed entirely from already-fetched Lead rows, the same
 * deterministic style `buildLeadsInsight` (`LeadsListView.tsx`) already
 * established — this provider generalizes that one-liner into a bounded
 * list of concrete next steps instead of a single sentence.
 */
export const crmSuggestionProvider: SuggestionProvider = {
  module: "crm",
  async compute(): Promise<CopilotSuggestion[]> {
    const leads = await getLeads({ includeArchived: false });
    const now = Date.now();
    const suggestions: CopilotSuggestion[] = [];

    const staleQualified = leads.filter(
      (lead) => lead.status === "qualified" && now - new Date(lead.updated_at).getTime() > ONE_WEEK_MS,
    );
    for (const lead of staleQualified.slice(0, 3)) {
      suggestions.push({
        id: `crm-follow-up-${lead.id}`,
        module: "crm",
        label: `Follow up with ${lead.first_name} ${lead.last_name}`,
        description: "Qualified for over a week with no update — a check-in keeps momentum before they cool off.",
        actionId: null,
        tone: "warning",
      });
    }

    const readyForProposal = leads.filter((lead) => lead.status === "qualified");
    if (readyForProposal.length > 0) {
      suggestions.push({
        id: "crm-send-proposal",
        module: "crm",
        label: `Send a proposal to ${readyForProposal.length} qualified lead${readyForProposal.length === 1 ? "" : "s"}`,
        description: "Qualified leads with no proposal yet are the highest-leverage next step in the pipeline.",
        // Informational: `generate-proposal` needs one specific eventId, and a
        // Lead has no Event of its own until it converts — nothing here
        // maps a whole cohort onto a single one-click action honestly.
        actionId: null,
        tone: "info",
      });
    }

    const waitingDecision = leads.filter((lead) => lead.status === "waiting_decision");
    if (waitingDecision.length > 0) {
      suggestions.push({
        id: "crm-decision-reminder",
        module: "crm",
        label: `Send a reminder to ${waitingDecision.length} lead${waitingDecision.length === 1 ? "" : "s"} awaiting a decision`,
        description: "A gentle nudge for proposals sent but not yet accepted or declined.",
        // Informational: this codebase has no lead-facing email/SMS action
        // (`create-notification` only notifies an internal Workspace
        // member) — see Known Limitations in the checkpoint docs.
        actionId: null,
        tone: "info",
      });
    }

    const readyToSchedule = leads.filter((lead) => lead.status === "contacted");
    if (readyToSchedule.length > 0) {
      suggestions.push({
        id: "crm-schedule-meeting",
        module: "crm",
        label: `Schedule a consultation for ${readyToSchedule.length} contacted lead${readyToSchedule.length === 1 ? "" : "s"}`,
        description: "Contacted leads with no consultation booked yet — the next natural step in the funnel.",
        actionId: null,
        tone: "info",
      });
    }

    return suggestions;
  },
};
