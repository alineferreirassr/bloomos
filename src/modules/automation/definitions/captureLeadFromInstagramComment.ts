import { CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramCommentAction";
import type { AutomationDefinition } from "@/types/automation";

export const CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID = "capture-lead-from-instagram-comment";

/**
 * SOCIAL-13H — closes the exact gap the SOCIAL-13G audit found: the
 * `instagram.comment_received` trigger and the
 * `create-lead-from-instagram-comment` Action have both existed since
 * SOCIAL-11E/13C, but nothing shipped them wired together — capture only
 * ever ran if a workspace admin hand-built a matching Workflow first. This
 * is that missing default wiring, registered the same way
 * `recordMemoryOnProposalRejection.ts` already is (see that file's own doc
 * comment for the "genuinely live-wired" precedent this follows):
 * `approvalPolicy: "never_required"`, `requiredPermissions: []`, and
 * `minimumRole: null` — all three required, not stylistic, because no
 * human is present at dispatch time (`metaWebhookProcessing.ts`'s own
 * `SYSTEM_DISPATCH_CONTEXT` carries `userId: null`, `role: null`,
 * `permissions: []`); any stricter policy would leave every Instagram Lead
 * stuck `pending_approval` forever with nobody able to grant it.
 *
 * Workspace isolation needs no code here — `trigger.workspaceId` (already
 * resolved server-side from the verified webhook, never from the request
 * body) flows straight through `dispatchAutomationTrigger` into the
 * Action's own `params.workspaceId`, the same way every other registered
 * Automation already works; a Definition itself is never workspace-scoped.
 *
 * A workspace that has ALSO hand-built its own Workflow on this same
 * trigger/action pair is unaffected and never produces a duplicate Lead:
 * `dispatchAutomationTrigger` fans out to every active Automation
 * independently, and `create-lead-from-instagram-comment` is already
 * idempotent (`findOrCreateInstagramLead`'s own workspace-scoped lookup +
 * the `instagram_external_id` partial unique index as the race-safe
 * backstop) — a second execution of the same Action for the same comment
 * finds, never re-creates, the Lead.
 */
const captureLeadFromInstagramComment: AutomationDefinition = {
  id: CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID,
  name: "Capture Lead from Instagram Comment",
  description: "Captures a new Lead by default whenever an Instagram comment is received — no Workflow needs to be built first.",
  category: "crm",
  version: "automation-def-capture-lead-from-instagram-comment-v1",
  status: "active",
  trigger: "instagram.comment_received",
  conditions: [],
  actionIds: [CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID],
  approvalPolicy: { kind: "never_required" },
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  maxRetries: 1,
};

export default captureLeadFromInstagramComment;
