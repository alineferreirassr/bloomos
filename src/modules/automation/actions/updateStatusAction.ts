import { updateEventStatus } from "@/lib/data";
import { EVENT_STATUSES, type EventStatus } from "@/core/enums/eventStatus";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const UPDATE_STATUS_ACTION_ID = "update-status";

function isEventStatus(value: unknown): value is EventStatus {
  return typeof value === "string" && (EVENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Scoped to Event status this checkpoint — BloomOS has no single universal
 * "status" concept spanning every entity (Leads/Clients/Contracts/Invoices
 * each own a *different* status enum), and Events are the most central,
 * unambiguous fit for a generic "update status" example. Extending this to
 * another entity type later needs no change to the Automation Engine
 * itself — only a second Action (e.g. `update-contract-status`) registered
 * the same way, per Step 14's own "a new automation should require only
 * Trigger/Conditions/Actions/Registration" developer-experience guarantee.
 */
const updateStatusAction: AutomationActionDefinition = {
  id: UPDATE_STATUS_ACTION_ID,
  name: "Update Status",
  description: "Updates an Event's own status field.",
  category: "operations",
  version: "automation-action-update-status-v1",
  requiredPermissions: ["events.update"],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const eventId = params.facts.eventId;
    const status = params.facts.status;
    if (typeof eventId !== "string" || !isEventStatus(status)) {
      return { success: false, message: "Missing eventId or a valid status in the trigger's own facts." };
    }

    const result = await updateEventStatus(eventId, status);
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Event status updated to "${status}".`, resultRef: { type: "event", id: result.data.id } };
  },
};

export default updateStatusAction;
