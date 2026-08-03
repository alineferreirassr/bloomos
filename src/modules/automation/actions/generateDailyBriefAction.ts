import { generateDailyOperationsBrief } from "@/modules/ai/dailyBrief/generateDailyOperationsBrief";
import type { AutomationActionDefinition, AutomationActionResultDetail } from "@/types/automation";

export const GENERATE_DAILY_BRIEF_ACTION_ID = "generate-daily-brief";

/** A genuine, working action — calls `generateDailyOperationsBrief()` directly, the same wrapper `/dashboard`'s own card calls. See `generateProposalAction.ts`'s own doc comment for why calling a session-resolving wrapper directly is safe here. */
const generateDailyBriefAction: AutomationActionDefinition = {
  id: GENERATE_DAILY_BRIEF_ACTION_ID,
  name: "Generate Daily Brief",
  description: "Runs the Daily Operations Brief Skill for the Workspace, through executeSkill().",
  category: "operations",
  version: "automation-action-generate-daily-brief-v1",
  requiredPermissions: ["events.view"],
  featureFlag: null,
  minimumRole: null,
  async execute(): Promise<AutomationActionResultDetail> {
    const result = await generateDailyOperationsBrief();
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Daily Brief generated (confidence ${result.data.brief.confidence}%).` };
  },
};

export default generateDailyBriefAction;
