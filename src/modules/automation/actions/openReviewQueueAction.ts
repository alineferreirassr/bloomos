import { getCoreNotificationsService } from "@/core/notifications";
import type { EntityType } from "@/core/enums/entityType";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const OPEN_REVIEW_QUEUE_ACTION_ID = "open-review-queue";

/**
 * BloomOS has no dedicated "Review Queue" module yet — rather than
 * fabricate one, this action flags a real record for human review the
 * same way every other "assist, not replace" surface in this codebase
 * already does: an in-app Notification a reviewer actually sees, linked
 * back to the record via `related_owner_type`/`related_owner_id`. An
 * honest, working action, not a placeholder new data structure.
 */
const openReviewQueueAction: AutomationActionDefinition = {
  id: OPEN_REVIEW_QUEUE_ACTION_ID,
  name: "Open Review Queue",
  description: "Flags a real BloomOS record for human review via an in-app Notification.",
  category: "notifications",
  version: "automation-action-open-review-queue-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const recipientMemberId = params.facts.recipientMemberId;
    const ownerType = params.facts.ownerType;
    const ownerId = params.facts.ownerId;
    if (typeof recipientMemberId !== "string" || typeof ownerType !== "string" || typeof ownerId !== "string") {
      return { success: false, message: "Missing recipientMemberId, ownerType, or ownerId in the trigger's own facts." };
    }
    const reason = typeof params.facts.reason === "string" ? params.facts.reason : "Needs review.";

    const result = await getCoreNotificationsService().createInAppNotification(params.workspaceId, {
      recipientMemberId,
      title: "Ready for review",
      body: reason,
      relatedOwnerType: ownerType as EntityType,
      relatedOwnerId: ownerId,
    });

    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: "Review request opened.", resultRef: { type: "notification", id: result.data.id } };
  },
};

export default openReviewQueueAction;
