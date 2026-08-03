import { getCoreNotificationsService, NOTIFICATION_KINDS } from "@/core/notifications";
import type { NotificationKind } from "@/core/notifications";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";
import type { EntityType } from "@/core/enums/entityType";

export const CREATE_NOTIFICATION_ACTION_ID = "create-notification";

/**
 * A genuine, working action — reuses `getCoreNotificationsService()`
 * (Checkpoint 2's own foundation) directly, never a fabricated stand-in.
 * Reads `facts.recipientMemberId`/`facts.title`/`facts.body` and, if
 * present, `facts.relatedOwnerType`/`facts.relatedOwnerId` — every one a
 * plain, already-safe string the Automation itself put in the trigger's
 * own `facts` bag (never a raw record dump).
 */
const createNotificationAction: AutomationActionDefinition = {
  id: CREATE_NOTIFICATION_ACTION_ID,
  name: "Create Notification",
  description: "Creates an in-app Notification for a Workspace member.",
  category: "notifications",
  version: "automation-action-create-notification-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const recipientMemberId = params.facts.recipientMemberId;
    const title = params.facts.title;
    const body = params.facts.body;
    if (typeof recipientMemberId !== "string" || typeof title !== "string" || typeof body !== "string") {
      return { success: false, message: "Missing recipientMemberId, title, or body in the trigger's own facts." };
    }

    const relatedOwnerType = typeof params.facts.relatedOwnerType === "string" ? (params.facts.relatedOwnerType as EntityType) : null;
    const relatedOwnerId = typeof params.facts.relatedOwnerId === "string" ? params.facts.relatedOwnerId : null;
    const kind =
      typeof params.facts.notificationKind === "string" && (NOTIFICATION_KINDS as readonly string[]).includes(params.facts.notificationKind)
        ? (params.facts.notificationKind as NotificationKind)
        : null;

    const result = await getCoreNotificationsService().createInAppNotification(params.workspaceId, {
      recipientMemberId,
      title,
      body,
      relatedOwnerType,
      relatedOwnerId,
      kind,
    });

    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Notification "${title}" created.`, resultRef: { type: "notification", id: result.data.id } };
  },
};

export default createNotificationAction;
