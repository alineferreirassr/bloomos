import { getCoreDispatchBatchesService } from "@/core/dispatch";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const CREATE_DISPATCH_ACTION_ID = "create-dispatch";

/**
 * v2.0 Checkpoint 39 — calls the real Dispatch Batches service directly
 * (`getCoreDispatchBatchesService().createBatch()`), the exact function
 * `createDispatchBatchAction()` (`modules/dispatch/dispatchActions.ts`)
 * itself calls after its own `resolveMemberSessionSnapshot()` — this
 * Action bypasses that session-resolving wrapper the same way
 * `createTaskAction` bypasses `getCoreNotesService()`'s own "use server"
 * layer, using the trigger context's own `workspaceId`/`userId` instead of
 * a live request session.
 */
const createDispatchAction: AutomationActionDefinition = {
  id: CREATE_DISPATCH_ACTION_ID,
  name: "Create Dispatch",
  description: "Creates a new Dispatch Batch from a list of real Dispatch Order ids.",
  category: "operations",
  version: "automation-action-create-dispatch-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const name = params.facts.name;
    const orderIdsRaw = params.facts.orderIds;
    if (typeof name !== "string") {
      return { success: false, message: "Missing name in the trigger's own facts." };
    }
    const orderIds = typeof orderIdsRaw === "string" ? orderIdsRaw.split(",").map((id) => id.trim()).filter((id) => id.length > 0) : [];
    if (orderIds.length === 0) {
      return { success: false, message: "Missing orderIds (comma-separated Dispatch Order ids) in the trigger's own facts." };
    }

    const result = await getCoreDispatchBatchesService().createBatch(params.workspaceId, params.userId ?? "system", { name, order_ids: orderIds });
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Dispatch batch "${result.data.name}" created with ${orderIds.length} order(s).` };
  },
};

export default createDispatchAction;
