import { registerAutomation } from "@/core/automation/registry";
import { registerAutomationActions } from "@/modules/automation/registerAutomationActions";
import notifyOnOverdueInvoice from "@/modules/automation/definitions/notifyOnOverdueInvoice";
import recordMemoryOnProposalRejection from "@/modules/automation/definitions/recordMemoryOnProposalRejection";
import suggestFollowUpProposal from "@/modules/automation/definitions/suggestFollowUpProposal";
import captureLeadFromInstagramComment from "@/modules/automation/definitions/captureLeadFromInstagramComment";
import captureLeadFromInstagramDm from "@/modules/automation/definitions/captureLeadFromInstagramDm";

let registered = false;

/**
 * Registers the 3 example Automations proving each of the Engine's own
 * approval policies has a real, working registration — Step 14's own
 * Developer Experience guarantee in action: each of these needed only a
 * Trigger + Conditions + Actions + this one registration call, nothing
 * else. Also registers every Action first (`registerAutomationActions`),
 * since an Automation Definition referencing an unregistered Action id
 * would silently no-op at execution time rather than fail loudly.
 *
 * SOCIAL-13H adds the 2 default Instagram Lead-capture Automations
 * (`captureLeadFromInstagramComment`/`captureLeadFromInstagramDm`) —
 * closing the SOCIAL-13G audit's own gap where the Instagram triggers and
 * Lead-capture Actions existed but nothing wired them together by
 * default. Same registration mechanism, nothing new.
 */
export function registerAutomationDefinitions(): void {
  if (registered) return;
  registerAutomationActions();
  registerAutomation(notifyOnOverdueInvoice);
  registerAutomation(recordMemoryOnProposalRejection);
  registerAutomation(suggestFollowUpProposal);
  registerAutomation(captureLeadFromInstagramComment);
  registerAutomation(captureLeadFromInstagramDm);
  registered = true;
}
