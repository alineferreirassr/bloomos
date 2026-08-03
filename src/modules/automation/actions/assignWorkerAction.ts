import { getCoreWorkersService, getCoreAssignmentsService } from "@/core/workforce";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { resolveAssignableNodeType } from "@/core/workforce/assignmentEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { ASSIGNABLE_TYPES, type AssignableType } from "@/types/workforce";
import { clockNow } from "@/core/time/clock";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const ASSIGN_WORKER_ACTION_ID = "assign-worker";

/**
 * v2.0 Checkpoint 39 — replicates `createAssignmentAction()`'s own real
 * steps (`modules/workforce/workforceActions.ts`) directly against the
 * Core services it itself calls (`getCoreAssignmentsService().createAssignment`,
 * the "assigned_to" Knowledge Graph relationship, the Timeline record) —
 * bypassing only that action's own `resolveMemberSessionSnapshot()`, since
 * this runs from the trigger context's own `workspaceId`/`userId`, not a
 * live request session.
 */
const assignWorkerAction: AutomationActionDefinition = {
  id: ASSIGN_WORKER_ACTION_ID,
  name: "Assign Worker",
  description: "Assigns a real Worker to an Event, Client, or other assignable record.",
  category: "operations",
  version: "automation-action-assign-worker-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const workerId = params.facts.workerId;
    const assignableType = params.facts.assignableType;
    const assignableId = params.facts.assignableId;
    if (typeof workerId !== "string" || typeof assignableType !== "string" || typeof assignableId !== "string") {
      return { success: false, message: "Missing workerId, assignableType, or assignableId in the trigger's own facts." };
    }
    if (!(ASSIGNABLE_TYPES as readonly string[]).includes(assignableType)) {
      return { success: false, message: `"${assignableType}" is not a real assignable type.` };
    }

    const worker = await getCoreWorkersService().getWorkerById(workerId);
    if (!worker || worker.workspace_id !== params.workspaceId) return { success: false, message: "This worker could not be found." };
    if (worker.status === "terminated") return { success: false, message: "A terminated worker cannot be assigned." };
    if (worker.status === "on_leave") return { success: false, message: "A worker on leave cannot be assigned." };

    const result = await getCoreAssignmentsService().createAssignment(params.workspaceId, params.userId ?? "system", {
      worker_id: workerId,
      assignable_type: assignableType as AssignableType,
      assignable_id: assignableId,
      role_note: null,
      starts_at: clockNow().toISOString(),
    });
    if (!result.success) return { success: false, message: result.error };

    const nodeType = resolveAssignableNodeType(assignableType as AssignableType);
    if (nodeType) {
      await getCoreKnowledgeGraphService().createRelationship(params.workspaceId, params.userId ?? "system", {
        sourceNodeType: "worker",
        sourceNodeId: worker.id,
        targetNodeType: nodeType,
        targetNodeId: assignableId,
        relationshipType: "assigned_to",
        source: "automation",
      });
    }

    recordTimelineActivity(params.workspaceId, "worker", worker.id, "assignment_created", `${worker.first_name} ${worker.last_name} assigned via Workflow automation.`);
    return { success: true, message: `Worker assigned.`, resultRef: { type: "worker", id: worker.id } };
  },
};

export default assignWorkerAction;
