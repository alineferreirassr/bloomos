import { getVendorById } from "@/lib/data";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

const VENDOR_NAME = (vendor: { company_name: string; display_name: string | null }): string => vendor.display_name ?? vendor.company_name;

export const ASSIGN_VENDOR_ACTION_ID = "assign-vendor";

/**
 * v2.0 Checkpoint 39 — a fixed-relationship-type convenience wrapper
 * around the exact same real Knowledge Graph service `assign-worker` and
 * the generic `add-relationship` Action both call
 * (`getCoreKnowledgeGraphService().createRelationship()`) — always a
 * `vendor --assigned_to--> event` edge, never a new bookkeeping structure.
 */
const assignVendorAction: AutomationActionDefinition = {
  id: ASSIGN_VENDOR_ACTION_ID,
  name: "Assign Vendor",
  description: "Links a real Vendor to an Event as assigned.",
  category: "operations",
  version: "automation-action-assign-vendor-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const vendorId = params.facts.vendorId;
    const eventId = params.facts.eventId;
    if (typeof vendorId !== "string" || typeof eventId !== "string") {
      return { success: false, message: "Missing vendorId or eventId in the trigger's own facts." };
    }

    const vendor = await getVendorById(vendorId).catch(() => null);
    if (!vendor || vendor.workspace_id !== params.workspaceId) return { success: false, message: "This vendor could not be found." };

    const result = await getCoreKnowledgeGraphService().createRelationship(params.workspaceId, params.userId ?? "system", {
      sourceNodeType: "vendor",
      sourceNodeId: vendor.id,
      targetNodeType: "event",
      targetNodeId: eventId,
      relationshipType: "assigned_to",
      source: "automation",
    });
    if (!result.success) return { success: false, message: result.error };

    recordTimelineActivity(params.workspaceId, "vendor", vendor.id, "knowledge_relationship_created", `${VENDOR_NAME(vendor)} assigned to Event via Workflow automation.`);
    return { success: true, message: `Vendor "${VENDOR_NAME(vendor)}" assigned.`, resultRef: { type: "vendor", id: vendor.id } };
  },
};

export default assignVendorAction;
