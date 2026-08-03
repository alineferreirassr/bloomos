import { registerWorkspaceMergeFields } from "@/modules/documentTemplates/mergeFields/workspaceMergeFields";
import { registerCrmMergeFields } from "@/modules/documentTemplates/mergeFields/crmMergeFields";
import { registerFinanceMergeFields } from "@/modules/documentTemplates/mergeFields/financeMergeFields";
import { registerWorkflowMergeFields } from "@/modules/documentTemplates/mergeFields/workflowMergeFields";
import { registerAutomationMergeFields } from "@/modules/documentTemplates/mergeFields/automationMergeFields";
import { registerMemoryMergeFields } from "@/modules/documentTemplates/mergeFields/memoryMergeFields";
import { registerUserMergeFields } from "@/modules/documentTemplates/mergeFields/userMergeFields";
import { registerSettingsMergeFields } from "@/modules/documentTemplates/mergeFields/settingsMergeFields";
import { registerLeadMergeFields } from "@/modules/documentTemplates/mergeFields/leadMergeFields";
import { registerVendorMergeFields } from "@/modules/documentTemplates/mergeFields/vendorMergeFields";
import { registerProposalMergeFields } from "@/modules/documentTemplates/mergeFields/proposalMergeFields";
import { registerPaymentsMergeFields } from "@/modules/documentTemplates/mergeFields/paymentsMergeFields";
import { registerJourneyMergeFields } from "@/modules/documentTemplates/mergeFields/journeyMergeFields";
import { registerBrandMergeFields } from "@/modules/documentTemplates/mergeFields/brandMergeFields";
import { registerTimelineMergeFields } from "@/modules/documentTemplates/mergeFields/timelineMergeFields";

let registered = false;

/**
 * Registers every Merge Field across all 15 domains — the original 8
 * (Workspace, CRM, Finance, Workflow, Automation, Memory, User, Settings)
 * plus v2 Checkpoint 44's 7 (Lead, Vendor, Proposal, Payments, Journey,
 * Brand, Timeline) — idempotent, the same module-level guard
 * `registerDocumentTypes()`/`registerWorkflowNodes()` already use. Per
 * Step 18's own Developer Experience guarantee, a future Merge Field
 * needs only its own domain file entry — nothing in the Compiler or
 * Template Engine changes.
 */
export function registerMergeFields(): void {
  if (registered) return;
  registerWorkspaceMergeFields();
  registerCrmMergeFields();
  registerFinanceMergeFields();
  registerWorkflowMergeFields();
  registerAutomationMergeFields();
  registerMemoryMergeFields();
  registerUserMergeFields();
  registerSettingsMergeFields();
  registerLeadMergeFields();
  registerVendorMergeFields();
  registerProposalMergeFields();
  registerPaymentsMergeFields();
  registerJourneyMergeFields();
  registerBrandMergeFields();
  registerTimelineMergeFields();
  registered = true;
}

/** Test-only: clears the idempotency guard so a test that also resets the underlying registries can call `registerMergeFields()` again and see it actually re-populate. */
export function resetMergeFieldsRegistration(): void {
  registered = false;
}
