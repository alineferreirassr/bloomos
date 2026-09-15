import { findOrCreateInstagramLead } from "@/core/automation/instagramLeadCapture";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID = "create-lead-from-instagram-comment";

/**
 * SOCIAL-13C — the first real Instagram Lead-capture Action, built on
 * SOCIAL-13C-FND's own data foundation (nullable `email`/`first_name`/
 * `last_name`, the new `instagram_external_id` column and its partial
 * unique index) and the enriched facts SOCIAL-13B added. Reads only the
 * facts already established for `instagram.comment_received`
 * (`metaWebhookProcessing.ts`'s own `dispatchInstagramTrigger` call) — adds
 * no new fact, invents no data. Zero Meta call, zero reply, zero AI: this
 * is pure domain-side Lead capture, mirroring how `replyToInstagramCommentAction.ts`
 * (SOCIAL-12C) is pure Meta-outbound and never touches a Lead.
 *
 * `externalAuthorId` (already in facts, SOCIAL-11E) becomes
 * `Lead.instagram_external_id` — the one stable, indexable identifier this
 * checkpoint's own dedup barrier is built on. `externalAuthorUsername`
 * (SOCIAL-13B) becomes `Lead.instagram` — the mutable, free-text username,
 * never confused with the external id (see `findOrCreateInstagramLead`'s
 * own doc comment for why these two fields exist separately at all).
 * `commentText` (SOCIAL-13B) becomes `Lead.message`, verbatim — never
 * sanitized, truncated, or replaced with a generated summary.
 * `first_name`/`last_name`/`email`/`phone` are always `null` here — Meta's
 * own comment payload never carries any of them, and this checkpoint's own
 * authorization forbids inventing a placeholder for any of them.
 *
 * Duplicate handling is `findOrCreateInstagramLead`'s own responsibility
 * (workspace-scoped lookup + the partial unique index as the final,
 * race-safe authority) — this file never queries `leads` itself and never
 * treats "already exists" as a failure: both outcomes return
 * `{success: true}`, distinguished only by message/resultRef, matching this
 * codebase's own boolean-only Action Result convention rather than
 * inventing a third "duplicate" status the engine doesn't have.
 */
const createLeadFromInstagramCommentAction: AutomationActionDefinition = {
  id: CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID,
  name: "Create Lead from Instagram Comment",
  description: "Captures a new Lead (or recognizes an existing one) from an Instagram comment, keyed on the commenter's stable external Instagram id.",
  category: "crm",
  version: "automation-action-create-lead-from-instagram-comment-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const externalAuthorId = params.facts.externalAuthorId;
    if (typeof externalAuthorId !== "string" || !externalAuthorId.trim()) {
      return { success: false, message: "Instagram external identity is required to capture a Lead safely — none was available in this comment's own facts." };
    }

    const externalAuthorUsername = typeof params.facts.externalAuthorUsername === "string" ? params.facts.externalAuthorUsername : null;
    const commentText = typeof params.facts.commentText === "string" ? params.facts.commentText : null;

    const result = await findOrCreateInstagramLead({
      workspaceId: params.workspaceId,
      source: "Instagram",
      instagramExternalId: externalAuthorId,
      instagram: externalAuthorUsername,
      message: commentText,
      firstName: null,
      lastName: null,
      email: null,
    });

    if (!result.success) return { success: false, message: result.error };

    return result.data.created
      ? { success: true, message: "Created a new Lead from this Instagram comment.", resultRef: { type: "lead", id: result.data.lead.id } }
      : { success: true, message: "A Lead already exists for this Instagram identity — no duplicate created.", resultRef: { type: "lead", id: result.data.lead.id } };
  },
};

export default createLeadFromInstagramCommentAction;
