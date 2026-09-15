import { CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramDmAction";
import type { AutomationDefinition } from "@/types/automation";

export const CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID = "capture-lead-from-instagram-dm";

/**
 * SOCIAL-13H — the DM sibling of `captureLeadFromInstagramComment.ts`; see
 * that file's own doc comment for the full "why never_required / why no
 * code change was needed in the Action itself / why a hand-built Workflow
 * on the same pair never produces a duplicate Lead" reasoning, which
 * applies identically here.
 *
 * `create-lead-from-instagram-dm` already only reads `params.facts.direction
 * === "inbound"` before doing anything (`createLeadFromInstagramDmAction.ts`'s
 * own defensive check) — an outbound DM never reaches this far regardless,
 * since `metaWebhookProcessing.ts`'s `processMessagingEntry` never even
 * dispatches `instagram.message_received` for one; this Definition adds no
 * further outbound guard because the Action already owns that check.
 */
const captureLeadFromInstagramDm: AutomationDefinition = {
  id: CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID,
  name: "Capture Lead from Instagram DM",
  description: "Captures a new Lead by default whenever an inbound Instagram DM is received — no Workflow needs to be built first.",
  category: "crm",
  version: "automation-def-capture-lead-from-instagram-dm-v1",
  status: "active",
  trigger: "instagram.message_received",
  conditions: [],
  actionIds: [CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID],
  approvalPolicy: { kind: "never_required" },
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  maxRetries: 1,
};

export default captureLeadFromInstagramDm;
