import { listInstagramConversationsForWorkspace } from "@/lib/data";
import { resolveInstagramDirectMessageContext } from "@/core/automation/instagramDirectMessageServiceRole";
import { MetaProvider, isMetaAuthError, isMetaRateLimitError } from "@/core/integrations/providers/meta/metaProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const SEND_INSTAGRAM_DIRECT_MESSAGE_ACTION_ID = "send-instagram-direct-message";

/**
 * SOCIAL-12D — the second Instagram Comment/DM Automation Action, mirroring
 * `replyToInstagramCommentAction.ts` (SOCIAL-12C) exactly in shape. Reuses
 * SOCIAL-12B's own `MetaProvider.sendInstagramDirectMessage` exactly as
 * built — this file makes zero Meta network calls of its own, never
 * imports `fetch` directly, and never resolves a token itself beyond
 * calling `resolveInstagramDirectMessageContext` (a new, narrow
 * service-role boundary, SOCIAL-12D's own — see its own doc comment for
 * why a new narrow file, not a generalized SOCIAL-12C one, matches this
 * checkpoint's own explicit "prefer the minimal, safe option" instruction).
 *
 * `facts.conversationId` reuses SOCIAL-11E's own exact fact key verbatim
 * (`metaWebhookProcessing.ts`'s `dispatchInstagramTrigger` call for
 * `instagram.message_received`) — the *domain* id of the
 * `instagram_conversations` row, never a Meta id directly. `facts.dmMessage`
 * is a new fact key this checkpoint introduces, for the exact same reason
 * `replyToInstagramCommentAction.ts`'s own `facts.replyMessage` was:
 * outbound, caller-authored text has no existing convention to reuse, since
 * every prior Action's own facts are trigger-supplied data. **Nothing in
 * the current production pipeline populates `dmMessage` yet** — SOCIAL-11E's
 * own dispatch call only ever sets `messageId`/`conversationId`/
 * `instagramAccountIdentityId`/`direction`. Supplying it is
 * Workflow-Builder-configuration-shaped work this checkpoint's own
 * authorization explicitly reserves for a future checkpoint — this Action
 * is deliberately usable today only via a manual/test dispatch that already
 * supplies both facts, exactly like every other Action in this registry.
 *
 * Domain-id -> `recipientInstagramScopedId` resolution deliberately uses
 * only the smallest pre-existing, already-workspace-scoped read available —
 * `listInstagramConversationsForWorkspace(workspaceId)` (SOCIAL-11D) —
 * rather than adding a new `getConversationById` repository method:
 * `instagram_conversations` exposes no such method today (only
 * `getConversationByExternalParticipantId`/`getConversationByExternalConversationId`,
 * both scoped the other direction, plus this list), and this checkpoint's
 * own authorization requires a HARD STOP before adding a new access layer.
 * `InstagramConversation.external_participant_id` (never
 * `external_conversation_id`, a different, Meta-optional field
 * `sendInstagramDirectMessage` neither accepts nor needs — see
 * `metaProvider.ts`'s own doc comment) is exactly the IGSID Meta's endpoint
 * requires; filtering the already-workspace-scoped list is what makes
 * workspace isolation structural here, not an extra check this file has to
 * get right on its own.
 *
 * `pageId` comes from `resolveInstagramDirectMessageContext` (the
 * connection's own existing `config.meta_page_id`, the same field
 * `metaAccountActions.ts` already reads) — never from the conversation row,
 * which has no page reference of its own.
 *
 * The same retry-after-ambiguous-failure double-send risk
 * `replyToInstagramCommentAction.ts`'s own doc comment documents applies
 * identically here (`actionRunner.ts`'s own generic retry loop, unchanged):
 * no equivalent "already sent" marker exists on `instagram_messages` for an
 * outbound send, and adding one is a schema change this checkpoint's own
 * authorization requires a HARD STOP before making. An honestly-documented,
 * structural, pre-existing limitation shared by every Action in this
 * registry with an external side effect — not a new gap, and not something
 * this checkpoint is authorized to newly solve.
 */
const sendInstagramDirectMessageAction: AutomationActionDefinition = {
  id: SEND_INSTAGRAM_DIRECT_MESSAGE_ACTION_ID,
  name: "Send Instagram Direct Message",
  description: "Sends a text DM to an Instagram conversation's participant via the workspace's connected Meta account.",
  category: "general",
  version: "automation-action-send-instagram-direct-message-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const conversationId = params.facts.conversationId;
    const dmMessage = params.facts.dmMessage;
    if (typeof conversationId !== "string" || !conversationId.trim()) {
      return { success: false, message: "Missing conversationId in the trigger's own facts." };
    }
    if (typeof dmMessage !== "string" || !dmMessage.trim()) {
      return { success: false, message: "Missing dmMessage in the trigger's own facts." };
    }

    // Workspace-scoped by construction — see this file's own doc comment.
    const workspaceConversations = await listInstagramConversationsForWorkspace(params.workspaceId);
    const conversation = workspaceConversations.find((candidate) => candidate.id === conversationId);
    if (!conversation) {
      return { success: false, message: "That Instagram conversation could not be found in this workspace." };
    }
    if (conversation.status !== "active") {
      return { success: false, message: "That Instagram conversation is archived and can no longer receive a message." };
    }
    if (!conversation.external_participant_id.trim()) {
      return { success: false, message: "That Instagram conversation has no external participant id on record." };
    }

    const context = await resolveInstagramDirectMessageContext(params.workspaceId);
    if (!context.success) {
      return { success: false, message: context.failure.message };
    }

    try {
      const provider = new MetaProvider(context.accessToken);
      const sent = await provider.sendInstagramDirectMessage(context.pageId, { recipientInstagramScopedId: conversation.external_participant_id, text: dmMessage });
      return { success: true, message: `Sent Instagram DM (message id ${sent.messageId}).` };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Unknown Meta error";

      // Same explicit isMetaAuthError/isMetaRateLimitError branching as
      // replyToInstagramCommentAction.ts's own catch block, for the same
      // documented reason: Meta's real rate-limit message shape does not
      // match errorSanitizer.ts's generic regex, so the generic classifier
      // alone would misfile it as "validation." actionRunner.ts's own
      // retry loop (unchanged) still retries any failure identically —
      // this is for an honest, correctly-classified audit message only.
      if (isMetaAuthError(error)) {
        return { success: false, message: "Reconnect Meta with DM-send permission to enable this automation." };
      }
      if (isMetaRateLimitError(error)) {
        return { success: false, message: "Meta rate-limited this request — it may succeed if retried." };
      }

      const record = sanitizeIntegrationError({ connectionId: context.connectionId, providerId: "meta", rawMessage });
      return { success: false, message: record.message };
    }
  },
};

export default sendInstagramDirectMessageAction;
