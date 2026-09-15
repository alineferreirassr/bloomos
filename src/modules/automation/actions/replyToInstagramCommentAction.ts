import { listInstagramCommentsForWorkspace } from "@/lib/data";
import { resolveInstagramCommentReplyContext } from "@/core/automation/instagramCommentReplyServiceRole";
import { MetaProvider, isMetaAuthError, isMetaRateLimitError } from "@/core/integrations/providers/meta/metaProvider";
import { sanitizeIntegrationError } from "@/core/integrations/errorSanitizer";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const REPLY_TO_INSTAGRAM_COMMENT_ACTION_ID = "reply-to-instagram-comment";

/**
 * SOCIAL-12C — the first Instagram Comment/DM Automation Action, and the
 * first Action anywhere in this codebase that calls a `MetaProvider`
 * outbound method. Reuses SOCIAL-12B's own `MetaProvider.replyToInstagramComment`
 * exactly as built — this file makes zero Meta network calls of its own,
 * never imports `fetch` directly, and never resolves a token itself
 * beyond calling `resolveInstagramCommentReplyContext` (a new, narrow
 * service-role boundary, SOCIAL-12C's own — see its own doc comment for
 * why a new narrow file, not a shared one, matches this codebase's own
 * four-times-repeated precedent).
 *
 * `facts.commentId` reuses SOCIAL-11E's own exact fact key verbatim
 * (`metaWebhookProcessing.ts`'s `dispatchInstagramTrigger` call for
 * `instagram.comment_received`) — the *domain* id of the `instagram_comments`
 * row, never the external Meta id directly (nothing in the current trigger
 * payload/event context exposes that; see this file's own resolution step
 * below for why). `facts.replyMessage` is a new fact key this checkpoint
 * introduces — no existing convention already represented "outbound text to
 * send," since no Action before this one has ever needed static, non-inbound
 * configured content; every existing Action's own facts are trigger-supplied
 * data, not caller-authored copy. **Nothing in the current production
 * pipeline populates `replyMessage` yet** — SOCIAL-11E's own dispatch call
 * only ever sets `commentId`/`instagramAccountIdentityId`/`externalAuthorId`/
 * `hasParent`. Supplying `replyMessage` (a configured reply template, a
 * human-authored draft, or similar) is Workflow-Builder-configuration-shaped
 * work this checkpoint's own authorization explicitly reserves for a future
 * checkpoint — this Action is deliberately usable today only via a manual/
 * test dispatch that already supplies both facts, exactly like every other
 * Action in this registry is independently testable before any
 * `AutomationDefinition` wires it to a real trigger.
 *
 * Domain-id -> external-id resolution deliberately uses only the smallest
 * pre-existing, already-workspace-scoped read available —
 * `listInstagramCommentsForWorkspace(workspaceId)` (SOCIAL-11D) — rather
 * than adding a new `getCommentById` repository method: `instagram_comments`
 * exposes no such method today (only `getCommentByExternalId`, scoped the
 * other direction, and this list), and this checkpoint's own authorization
 * requires a HARD STOP before adding a new access layer. Filtering the
 * already-workspace-scoped list is what makes workspace isolation
 * structural here (a comment id belonging to another workspace simply
 * never appears in this list), not an extra check this file has to get
 * right on its own.
 *
 * A reply-in-flight during a transient-failure retry (`actionRunner.ts`'s
 * own generic retry loop, unchanged by this checkpoint) could in principle
 * double-post if Meta's own write actually landed before the response
 * that triggered the retry — the exact same class of risk
 * `executeSocialPostPublish.ts` first documented and solved with a
 * dedicated `provider_container_id` re-check column. No equivalent column
 * exists on `instagram_comments` for a reply, and adding one is a schema
 * change this checkpoint's own authorization requires a HARD STOP before
 * making ("Não criar migration salvo se for absolutamente indispensável").
 * This is therefore an honestly-documented, structural, pre-existing
 * limitation shared by *every* Action in this registry with an external
 * side effect (`create-task`/`create-invoice`/`create-event`, none of
 * which solve it either) — not a new gap SOCIAL-12C introduces, and not
 * something this checkpoint is authorized to newly solve.
 */
const replyToInstagramCommentAction: AutomationActionDefinition = {
  id: REPLY_TO_INSTAGRAM_COMMENT_ACTION_ID,
  name: "Reply to Instagram Comment",
  description: "Posts a reply to an Instagram comment via the workspace's connected Meta account.",
  category: "general",
  version: "automation-action-reply-to-instagram-comment-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const commentId = params.facts.commentId;
    const replyMessage = params.facts.replyMessage;
    if (typeof commentId !== "string" || !commentId.trim()) {
      return { success: false, message: "Missing commentId in the trigger's own facts." };
    }
    if (typeof replyMessage !== "string" || !replyMessage.trim()) {
      return { success: false, message: "Missing replyMessage in the trigger's own facts." };
    }

    // Workspace-scoped by construction — see this file's own doc comment.
    const workspaceComments = await listInstagramCommentsForWorkspace(params.workspaceId);
    const comment = workspaceComments.find((candidate) => candidate.id === commentId);
    if (!comment) {
      return { success: false, message: "That Instagram comment could not be found in this workspace." };
    }
    if (comment.status !== "active") {
      return { success: false, message: "That Instagram comment has been removed and can no longer be replied to." };
    }
    if (!comment.external_comment_id.trim()) {
      return { success: false, message: "That Instagram comment has no external id on record." };
    }

    const context = await resolveInstagramCommentReplyContext(params.workspaceId);
    if (!context.success) {
      return { success: false, message: context.failure.message };
    }

    try {
      const provider = new MetaProvider(context.accessToken);
      const reply = await provider.replyToInstagramComment(comment.external_comment_id, replyMessage);
      return { success: true, message: `Replied to Instagram comment (reply id ${reply.replyId}).` };
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Unknown Meta error";

      // isMetaAuthError/isMetaRateLimitError are branched on explicitly,
      // ahead of the generic sanitizeIntegrationError classifier: Meta's
      // own real rate-limit message shape ("(#4) Application request limit
      // reached") does not actually match errorSanitizer.ts's generic
      // `/rate.?limit/i` regex (different wording entirely), so relying on
      // the generic classifier alone would misfile a genuine Meta
      // rate-limit failure as "validation" — not a hypothetical, a real gap
      // this checkpoint's own explicit "não usar string matching frágil se
      // já existir um padrão tipado apropriado" instruction requires
      // getting right. actionRunner.ts's own generic retry loop (unchanged)
      // retries any failure identically regardless of category — this
      // distinction is for an honest, correctly-classified audit message
      // only, never a second, competing retry mechanism.
      if (isMetaAuthError(error)) {
        return { success: false, message: "Reconnect Meta with comment-reply permission to enable this automation." };
      }
      if (isMetaRateLimitError(error)) {
        return { success: false, message: "Meta rate-limited this request — it may succeed if retried." };
      }

      const record = sanitizeIntegrationError({ connectionId: context.connectionId, providerId: "meta", rawMessage });
      return { success: false, message: record.message };
    }
  },
};

export default replyToInstagramCommentAction;
