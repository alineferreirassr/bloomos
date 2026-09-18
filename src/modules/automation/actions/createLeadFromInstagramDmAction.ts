import { listInstagramConversationsForWorkspace } from "@/lib/data";
import { findOrCreateInstagramLead } from "@/core/automation/instagramLeadCapture";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID = "create-lead-from-instagram-dm";

/**
 * SOCIAL-13C — the DM sibling of `createLeadFromInstagramCommentAction.ts`,
 * built the same way on SOCIAL-13C-FND's data foundation and SOCIAL-13B's
 * enriched facts. Zero Meta call, zero DM reply, zero AI.
 *
 * `instagram.message_received`'s own facts (`metaWebhookProcessing.ts`'s
 * `dispatchInstagramTrigger` call for this trigger, SOCIAL-11E/13B) do
 * *not* carry the participant's stable external id directly — only
 * `conversationId` (the domain id of an `instagram_conversations` row).
 * The stable id lives on that row's own `external_participant_id` column,
 * resolved here via `listInstagramConversationsForWorkspace(workspaceId)`
 * (SOCIAL-11D, already workspace-scoped) — the exact same established read
 * `sendInstagramDirectMessageAction.ts` (SOCIAL-12D) already uses to
 * resolve the same field for the same reason; no new repository method was
 * added. `externalParticipantUsername`/`messageText` (both SOCIAL-13B) are
 * read straight from facts, matching `Lead.instagram`/`Lead.message`
 * respectively, verbatim.
 *
 * `direction` is checked explicitly and defensively here — the trigger
 * itself is already only ever dispatched for inbound messages
 * (`processMessagingEntry`'s own construction, unchanged by this
 * checkpoint), but this Action never trusts that guarantee blindly, the
 * same defense-in-depth discipline every other workspace-scoped check in
 * this pipeline already follows.
 *
 * SOCIAL-15C — Content Attribution. `conversation` above is already the
 * real, workspace-scoped `InstagramConversation` row this Action resolves
 * for every DM capture (via `listInstagramConversationsForWorkspace`,
 * unchanged) — its own `id` becomes `Lead.instagram_conversation_id`,
 * exact-id evidence only, no new repository read required. Deliberately
 * never resolves or writes a `social_post_id` for a DM: Instagram DMs have
 * no post relationship in Meta's own model, and this checkpoint's own
 * authorization explicitly forbids attributing a DM to a Post by
 * proximity/inference — `DM -> Conversation -> Lead`, never `DM -> Post`.
 * Like the comment capture Action, `findOrCreateInstagramLead` only ever
 * writes this field on its own `create` branch — an existing Lead is
 * returned untouched, so a redelivered DM can never overwrite or alter an
 * existing Lead's attribution.
 */
const createLeadFromInstagramDmAction: AutomationActionDefinition = {
  id: CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID,
  name: "Create Lead from Instagram DM",
  description: "Captures a new Lead (or recognizes an existing one) from an inbound Instagram DM, keyed on the participant's stable external Instagram id.",
  category: "crm",
  version: "automation-action-create-lead-from-instagram-dm-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    if (params.facts.direction !== "inbound") {
      return { success: false, message: "Only an inbound Instagram DM can capture a Lead — this message was outbound." };
    }

    const conversationId = params.facts.conversationId;
    if (typeof conversationId !== "string" || !conversationId.trim()) {
      return { success: false, message: "Missing conversationId in the trigger's own facts." };
    }

    // Workspace-scoped by construction — see this file's own doc comment.
    const workspaceConversations = await listInstagramConversationsForWorkspace(params.workspaceId);
    const conversation = workspaceConversations.find((candidate) => candidate.id === conversationId);
    if (!conversation || !conversation.external_participant_id.trim()) {
      return { success: false, message: "Instagram external identity is required to capture a Lead safely — none was available for this conversation." };
    }

    const externalParticipantUsername = typeof params.facts.externalParticipantUsername === "string" ? params.facts.externalParticipantUsername : null;
    const messageText = typeof params.facts.messageText === "string" ? params.facts.messageText : null;

    const result = await findOrCreateInstagramLead({
      workspaceId: params.workspaceId,
      source: "Instagram",
      instagramExternalId: conversation.external_participant_id,
      instagram: externalParticipantUsername,
      instagramConversationId: conversation.id,
      message: messageText,
      firstName: null,
      lastName: null,
      email: null,
    });

    if (!result.success) return { success: false, message: result.error };

    return result.data.created
      ? { success: true, message: "Created a new Lead from this Instagram DM.", resultRef: { type: "lead", id: result.data.lead.id } }
      : { success: true, message: "A Lead already exists for this Instagram identity — no duplicate created.", resultRef: { type: "lead", id: result.data.lead.id } };
  },
};

export default createLeadFromInstagramDmAction;
