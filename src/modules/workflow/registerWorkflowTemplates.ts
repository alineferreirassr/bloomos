import { registerWorkflowTemplate } from "@/core/workflow/templateRegistry";
import { proposalAcceptedContractTemplate } from "@/modules/workflow/templates/proposalAcceptedContractTemplate";
import { invoicePaidFinanceTemplate } from "@/modules/workflow/templates/invoicePaidFinanceTemplate";
import { newClientWelcomeTemplate } from "@/modules/workflow/templates/newClientWelcomeTemplate";

let registered = false;

/** Registers Step 7's own 3 built-in Templates. Idempotent, the same module-level guard every other registration function in this codebase already uses. */
export function registerWorkflowTemplates(): void {
  if (registered) return;
  registerWorkflowTemplate(proposalAcceptedContractTemplate);
  registerWorkflowTemplate(invoicePaidFinanceTemplate);
  registerWorkflowTemplate(newClientWelcomeTemplate);
  registered = true;
}
