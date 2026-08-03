import { getCoreNotesService } from "@/core/notes";
import type { EntityType } from "@/core/enums/entityType";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const CREATE_TASK_ACTION_ID = "create-task";

/**
 * BloomOS has no generic "Task" module yet (only per-Event Checklist
 * Items) — rather than fabricate a new, fake Task store, this action
 * reuses the existing Notes concept (`core/notes`) with `category:
 * "reminder"`, attached to whatever real entity the trigger names via
 * `facts.ownerType`/`facts.ownerId`. An honest, working action against a
 * real BloomOS concept, not a placeholder pretending to be a full Task
 * system.
 *
 * Mock-mode only this checkpoint — `getCoreNotesService()` needs an
 * explicit Supabase client to write in `"supabase"` data mode (see its own
 * doc comment), which isn't yet threaded through the Automation Action
 * pipeline; see `docs/automation-engine.md`'s "Known limitations."
 */
const createTaskAction: AutomationActionDefinition = {
  id: CREATE_TASK_ACTION_ID,
  name: "Create Task",
  description: "Records a to-do (as a Note, category: reminder) attached to a real BloomOS record.",
  category: "operations",
  version: "automation-action-create-task-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const ownerType = params.facts.ownerType;
    const ownerId = params.facts.ownerId;
    const title = params.facts.title;
    if (typeof ownerType !== "string" || typeof ownerId !== "string" || typeof title !== "string") {
      return { success: false, message: "Missing ownerType, ownerId, or title in the trigger's own facts." };
    }

    const content = typeof params.facts.description === "string" ? params.facts.description : title;
    const result = await getCoreNotesService().createNoteForOwner(params.workspaceId, ownerType as EntityType, ownerId, params.userId ?? "system", {
      title,
      content,
      category: "reminder",
      priority: "normal",
    });

    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Task "${title}" recorded.`, resultRef: { type: ownerType as EntityType, id: ownerId } };
  },
};

export default createTaskAction;
