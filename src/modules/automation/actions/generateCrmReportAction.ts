import { generateCRMAssistantBrief } from "@/modules/ai/crmAssistant/generateCRMAssistantBrief";
import type { AutomationActionDefinition, AutomationActionResultDetail } from "@/types/automation";

export const GENERATE_CRM_REPORT_ACTION_ID = "generate-crm-report";

/** A genuine, working action — calls `generateCRMAssistantBrief()` directly, the same wrapper `/crm-assistant`'s own page calls. See `generateProposalAction.ts`'s own doc comment for why calling a session-resolving wrapper directly is safe here. */
const generateCrmReportAction: AutomationActionDefinition = {
  id: GENERATE_CRM_REPORT_ACTION_ID,
  name: "Generate CRM Report",
  description: "Runs the CRM Assistant Skill for the Workspace, through executeSkill().",
  category: "crm",
  version: "automation-action-generate-crm-report-v1",
  requiredPermissions: ["clients.view"],
  featureFlag: null,
  minimumRole: null,
  async execute(): Promise<AutomationActionResultDetail> {
    const result = await generateCRMAssistantBrief();
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `CRM report generated (confidence ${result.data.brief.confidence}%).` };
  },
};

export default generateCrmReportAction;
