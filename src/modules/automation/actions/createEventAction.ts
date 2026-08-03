import { createEvent } from "@/lib/data";
import type { EventType } from "@/core/enums/eventType";
import type { EventPriority } from "@/core/enums/eventPriority";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const CREATE_EVENT_ACTION_ID = "create-event";

/**
 * v2.0 Checkpoint 39 — calls the same `createEvent()` every "New Event"
 * form already calls (`lib/data/index.ts`), which itself already fires the
 * real `event.created` trigger (Checkpoint 39's own dead-trigger fix) — so
 * a Workflow built on this Action, in principle, could chain into another
 * Workflow listening for Event Created. `client_id`/`title`/`event_type`/
 * `priority` are the schema's own required fields (`eventFormSchema`);
 * everything else defaults to the schema's own empty-string/blank
 * allowances.
 */
const createEventAction: AutomationActionDefinition = {
  id: CREATE_EVENT_ACTION_ID,
  name: "Create Event",
  description: "Creates a new Event for a real Client.",
  category: "operations",
  version: "automation-action-create-event-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const clientId = params.facts.clientId;
    const title = params.facts.title;
    const eventType = params.facts.eventType;
    const priority = params.facts.priority;
    if (typeof clientId !== "string" || typeof title !== "string" || typeof eventType !== "string" || typeof priority !== "string") {
      return { success: false, message: "Missing clientId, title, eventType, or priority in the trigger's own facts." };
    }

    const result = await createEvent({
      client_id: clientId,
      originating_lead_id: "",
      title,
      event_type: eventType as EventType,
      event_date: "",
      start_time: "",
      end_time: "",
      timezone: "",
      location_name: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      latitude: "",
      longitude: "",
      guest_count: "",
      budget_min: "",
      budget_max: "",
      package_name: "",
      theme: "",
      color_palette: "",
      surprise_event: false,
      confidentiality_notes: "",
      accessibility_notes: "",
      dietary_notes: "",
      weather_plan: "",
      backup_location: "",
      internal_summary: "",
      assigned_owner: "",
      priority: priority as EventPriority,
    });
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Event "${result.data.title}" created.`, resultRef: { type: "event", id: result.data.id } };
  },
};

export default createEventAction;
