import { registerProposalSkill, PROPOSAL_SKILL_ID } from "@/modules/ai/proposal/registerProposalSkill";
import { registerEventOperationsBriefSkill } from "@/modules/ai/registerEventOperationsBriefSkill";
import { registerDailyOperationsBriefSkill, DAILY_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/dailyBrief/registerDailyOperationsBriefSkill";
import { registerBrowseAIMemorySkill } from "@/modules/ai/memory/registerBrowseAIMemorySkill";
import { registerCRMAssistantSkill, CRM_ASSISTANT_SKILL_ID } from "@/modules/ai/crmAssistant/registerCRMAssistantSkill";
import { registerFinanceAssistantSkill, FINANCE_ASSISTANT_SKILL_ID } from "@/modules/ai/financeAssistant/registerFinanceAssistantSkill";
import { registerUpcomingSkills } from "@/modules/ai/registerUpcomingSkills";
import { listSkills } from "@/core/ai/skills/registry";
import { GENERATE_PROPOSAL_ACTION_ID } from "@/modules/automation/actions/generateProposalAction";
import { GENERATE_DAILY_BRIEF_ACTION_ID } from "@/modules/automation/actions/generateDailyBriefAction";
import { GENERATE_CRM_REPORT_ACTION_ID } from "@/modules/automation/actions/generateCrmReportAction";
import { GENERATE_FINANCE_REPORT_ACTION_ID } from "@/modules/automation/actions/generateFinanceReportAction";
import { runSkillFallbackActionId } from "@/modules/automation/actions/runSkillActionFactory";
import { makeActionNode } from "@/modules/workflow/nodes/actionNodes";
import type { SkillCategory } from "@/core/ai/skills/types";
import type { WorkflowNodeDefinition } from "@/types/workflow";

/** Which real, already-registered Automation Action a given Skill's Workflow node should compile to — the 4 known Skills keep their existing bespoke Action; any other Skill uses the generic fallback `registerAutomationActions.ts` auto-registers for it. */
const KNOWN_SKILL_ACTION_IDS: Record<string, string> = {
  [PROPOSAL_SKILL_ID]: GENERATE_PROPOSAL_ACTION_ID,
  [DAILY_OPERATIONS_BRIEF_SKILL_ID]: GENERATE_DAILY_BRIEF_ACTION_ID,
  [CRM_ASSISTANT_SKILL_ID]: GENERATE_CRM_REPORT_ACTION_ID,
  [FINANCE_ASSISTANT_SKILL_ID]: GENERATE_FINANCE_REPORT_ACTION_ID,
};

const SKILL_CATEGORY_ICON: Record<SkillCategory, string> = {
  proposal: "FileText",
  operations: "RefreshCw",
  crm: "Users",
  finance: "DollarSign",
  documents: "FileStack",
  briefing: "Newspaper",
};

/**
 * Step 9's own "Every Skill should appear automatically... Discover Skills
 * from the Skill Registry" — this file is the Workflow node half (the
 * Automation Action half lives in `registerAutomationActions.ts`'s own
 * fallback-registration loop). Registers every Skill itself first (mirrors
 * `getBloomAIOverview.ts`'s own inline, idempotent registration-on-load —
 * this file has no other guaranteed opportunity to run before
 * `registerWorkflowNodes()` does), then builds one `WorkflowNodeDefinition`
 * per Skill that's actually runnable. A "Coming Soon" Skill (`execute`
 * undefined) gets no node — a node a member could drag onto the canvas but
 * that could never actually compile to a working Action would be worse
 * than not offering it at all.
 *
 * This — not `actionNodes.ts` — is why `registerWorkflowNodes.ts` is only
 * ever called from `"use server"` files: this file transitively imports
 * every Skill registration function, several of which reach `server-only`-
 * guarded AI provider/context modules the same way every other AI/Automation
 * entry point in this codebase already does.
 */
export function buildSkillActionNodes(): WorkflowNodeDefinition[] {
  registerProposalSkill();
  registerEventOperationsBriefSkill();
  registerDailyOperationsBriefSkill();
  registerBrowseAIMemorySkill();
  registerCRMAssistantSkill();
  registerFinanceAssistantSkill();
  registerUpcomingSkills();

  return listSkills()
    .filter((skill) => skill.execute)
    .map((skill) =>
      makeActionNode({
        id: `action.run-skill.${skill.id}`,
        name: skill.name,
        description: skill.description,
        icon: SKILL_CATEGORY_ICON[skill.category],
        compileTarget: KNOWN_SKILL_ACTION_IDS[skill.id] ?? runSkillFallbackActionId(skill.id),
      }),
    );
}
