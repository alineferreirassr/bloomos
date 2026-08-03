import { registerAutomation } from "@/core/automation/registry";
import { registerAutomationActions } from "@/modules/automation/registerAutomationActions";
import notifyOnOverdueInvoice from "@/modules/automation/definitions/notifyOnOverdueInvoice";
import recordMemoryOnProposalRejection from "@/modules/automation/definitions/recordMemoryOnProposalRejection";
import suggestFollowUpProposal from "@/modules/automation/definitions/suggestFollowUpProposal";

let registered = false;

/**
 * Registers the 3 example Automations proving each of the Engine's own
 * approval policies has a real, working registration — Step 14's own
 * Developer Experience guarantee in action: each of these needed only a
 * Trigger + Conditions + Actions + this one registration call, nothing
 * else. Also registers every Action first (`registerAutomationActions`),
 * since an Automation Definition referencing an unregistered Action id
 * would silently no-op at execution time rather than fail loudly.
 */
export function registerAutomationDefinitions(): void {
  if (registered) return;
  registerAutomationActions();
  registerAutomation(notifyOnOverdueInvoice);
  registerAutomation(recordMemoryOnProposalRejection);
  registerAutomation(suggestFollowUpProposal);
  registered = true;
}
