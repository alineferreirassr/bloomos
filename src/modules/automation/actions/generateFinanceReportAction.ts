import { generateFinanceAssistantBrief } from "@/modules/ai/financeAssistant/generateFinanceAssistantBrief";
import type { AutomationActionDefinition, AutomationActionResultDetail } from "@/types/automation";

export const GENERATE_FINANCE_REPORT_ACTION_ID = "generate-finance-report";

/** A genuine, working action — calls `generateFinanceAssistantBrief()` directly, the same wrapper `/finance-assistant`'s own page calls. See `generateProposalAction.ts`'s own doc comment for why calling a session-resolving wrapper directly is safe here. */
const generateFinanceReportAction: AutomationActionDefinition = {
  id: GENERATE_FINANCE_REPORT_ACTION_ID,
  name: "Generate Finance Report",
  description: "Runs the Finance Assistant Skill for the Workspace, through executeSkill().",
  category: "finance",
  version: "automation-action-generate-finance-report-v1",
  requiredPermissions: ["finance.view"],
  featureFlag: null,
  minimumRole: null,
  async execute(): Promise<AutomationActionResultDetail> {
    const result = await generateFinanceAssistantBrief();
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Finance report generated (confidence ${result.data.brief.confidence}%).` };
  },
};

export default generateFinanceReportAction;
