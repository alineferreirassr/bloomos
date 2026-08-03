import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const CREATE_TIMELINE_ENTRY_ACTION_ID = "create-timeline-entry";

/**
 * v2.0 Checkpoint 39 — a generic, author-controlled Timeline write, calling
 * `recordTimelineActivity()` directly (the same function every module's
 * own real mutation already calls). `TimelineActivity["type"]` is a closed
 * ~500-value union (`TIMELINE_ACTIVITY_TYPES`) — this Action always records
 * the one already-real, module-agnostic `"note_added"` type, with the
 * Workflow author's own free-form `description` as the actual content,
 * rather than fabricating a new "workflow_note" enum value.
 */
const createTimelineEntryAction: AutomationActionDefinition = {
  id: CREATE_TIMELINE_ENTRY_ACTION_ID,
  name: "Create Timeline Entry",
  description: "Records a custom Timeline activity on a real BloomOS record.",
  category: "general",
  version: "automation-action-create-timeline-entry-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const ownerType = params.facts.ownerType;
    const ownerId = params.facts.ownerId;
    const description = params.facts.description;
    if (typeof ownerType !== "string" || typeof ownerId !== "string" || typeof description !== "string") {
      return { success: false, message: "Missing ownerType, ownerId, or description in the trigger's own facts." };
    }
    if (!(ENTITY_TYPES as readonly string[]).includes(ownerType)) {
      return { success: false, message: `"${ownerType}" is not a real BloomOS entity type.` };
    }

    recordTimelineActivity(params.workspaceId, ownerType as EntityType, ownerId, "note_added", description);
    return { success: true, message: "Timeline entry recorded.", resultRef: { type: ownerType as EntityType, id: ownerId } };
  },
};

export default createTimelineEntryAction;
