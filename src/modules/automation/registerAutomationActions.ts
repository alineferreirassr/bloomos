import { registerAutomationAction } from "@/core/automation/actionRegistry";
import createTaskAction from "@/modules/automation/actions/createTaskAction";
import createNotificationAction from "@/modules/automation/actions/createNotificationAction";
import generateProposalAction from "@/modules/automation/actions/generateProposalAction";
import generateDailyBriefAction from "@/modules/automation/actions/generateDailyBriefAction";
import generateCrmReportAction from "@/modules/automation/actions/generateCrmReportAction";
import generateFinanceReportAction from "@/modules/automation/actions/generateFinanceReportAction";
import createMemoryAction from "@/modules/automation/actions/createMemoryAction";
import updateStatusAction from "@/modules/automation/actions/updateStatusAction";
import openReviewQueueAction from "@/modules/automation/actions/openReviewQueueAction";
import generateContractDocumentAction from "@/modules/automation/actions/generateContractDocumentAction";
import generateProposalDocumentAction from "@/modules/automation/actions/generateProposalDocumentAction";
import generateInvoiceDocumentAction from "@/modules/automation/actions/generateInvoiceDocumentAction";
import generateWelcomeGuideDocumentAction from "@/modules/automation/actions/generateWelcomeGuideDocumentAction";
import generateChecklistDocumentAction from "@/modules/automation/actions/generateChecklistDocumentAction";
import createEventAction from "@/modules/automation/actions/createEventAction";
import createInvoiceAction from "@/modules/automation/actions/createInvoiceAction";
import createDispatchAction from "@/modules/automation/actions/createDispatchAction";
import createTimelineEntryAction from "@/modules/automation/actions/createTimelineEntryAction";
import createExecutiveDecisionAction from "@/modules/automation/actions/createExecutiveDecisionAction";
import assignWorkerAction from "@/modules/automation/actions/assignWorkerAction";
import assignVendorAction from "@/modules/automation/actions/assignVendorAction";
import generateDocumentAction from "@/modules/automation/actions/generateDocumentAction";
import addRelationshipAction from "@/modules/automation/actions/addRelationshipAction";
import archiveEntityAction from "@/modules/automation/actions/archiveEntityAction";
import duplicateEntityAction from "@/modules/automation/actions/duplicateEntityAction";
import delayAction from "@/modules/automation/actions/delayAction";
import { makeRunSkillAction, runSkillFallbackActionId } from "@/modules/automation/actions/runSkillActionFactory";
import { registerProposalSkill, PROPOSAL_SKILL_ID } from "@/modules/ai/proposal/registerProposalSkill";
import { registerEventOperationsBriefSkill } from "@/modules/ai/registerEventOperationsBriefSkill";
import { registerDailyOperationsBriefSkill, DAILY_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/dailyBrief/registerDailyOperationsBriefSkill";
import { registerBrowseAIMemorySkill } from "@/modules/ai/memory/registerBrowseAIMemorySkill";
import { registerCRMAssistantSkill, CRM_ASSISTANT_SKILL_ID } from "@/modules/ai/crmAssistant/registerCRMAssistantSkill";
import { registerFinanceAssistantSkill, FINANCE_ASSISTANT_SKILL_ID } from "@/modules/ai/financeAssistant/registerFinanceAssistantSkill";
import { registerUpcomingSkills } from "@/modules/ai/registerUpcomingSkills";
import { listSkills } from "@/core/ai/skills/registry";
import type { AutomationCategory } from "@/types/automation";
import type { SkillCategory } from "@/core/ai/skills/types";

let registered = false;

/** Every Skill one of the four bespoke Actions above already wraps — the loop below skips these, registering a generic fallback only for a Skill nobody's hand-written a wrapper for. */
const SKILL_IDS_WITH_BESPOKE_ACTIONS = new Set([PROPOSAL_SKILL_ID, DAILY_OPERATIONS_BRIEF_SKILL_ID, CRM_ASSISTANT_SKILL_ID, FINANCE_ASSISTANT_SKILL_ID]);

const SKILL_CATEGORY_TO_AUTOMATION_CATEGORY: Record<SkillCategory, AutomationCategory> = {
  proposal: "proposal",
  operations: "operations",
  crm: "crm",
  finance: "finance",
  documents: "general",
  briefing: "operations",
};

/**
 * Registers Step 5's own 9 example Actions plus Checkpoint 12's own 5
 * "Generate X Document" Actions — every one already a real, working
 * implementation (never a stub), each proving a different corner of the
 * Action Registry: some call directly into existing Core services
 * (Notifications, Notes, Memory), some call into the Skills Layer
 * (Proposal/Daily Brief/CRM/Finance), one calls a plain domain mutation
 * (Event status), five call the Document Compiler
 * (`generateDocumentActionFactory.ts`). "Future actions should register
 * automatically" (Step 5) means adding another action needs only a new
 * file + one more call here — never a change to
 * `core/automation/actionRegistry.ts` itself.
 *
 * Checkpoint 13 adds one more, generic pass: every registered AI Skill
 * that's actually runnable (`skill.execute` defined — a "Coming Soon"
 * placeholder Skill gets no Action) and isn't already covered by one of
 * the four bespoke Skill-calling Actions above gets a fallback Action via
 * `makeRunSkillAction()`, auto-registered with zero code changes here the
 * next time a new Skill registers — the Action-Registry half of Step 9's
 * own "do not hardcode Proposal Generator, CRM Assistant, Finance
 * Assistant, Daily Brief; discover Skills from the Skill Registry."
 */
export function registerAutomationActions(): void {
  if (registered) return;
  registerAutomationAction(createTaskAction);
  registerAutomationAction(createNotificationAction);
  registerAutomationAction(generateProposalAction);
  registerAutomationAction(generateDailyBriefAction);
  registerAutomationAction(generateCrmReportAction);
  registerAutomationAction(generateFinanceReportAction);
  registerAutomationAction(createMemoryAction);
  registerAutomationAction(updateStatusAction);
  registerAutomationAction(openReviewQueueAction);
  registerAutomationAction(generateContractDocumentAction);
  registerAutomationAction(generateProposalDocumentAction);
  registerAutomationAction(generateInvoiceDocumentAction);
  registerAutomationAction(generateWelcomeGuideDocumentAction);
  registerAutomationAction(generateChecklistDocumentAction);
  // v2.0 Checkpoint 39 — Workflow & Automation Platform's own 11 new Actions.
  registerAutomationAction(createEventAction);
  registerAutomationAction(createInvoiceAction);
  registerAutomationAction(createDispatchAction);
  registerAutomationAction(createTimelineEntryAction);
  registerAutomationAction(createExecutiveDecisionAction);
  registerAutomationAction(assignWorkerAction);
  registerAutomationAction(assignVendorAction);
  registerAutomationAction(generateDocumentAction);
  registerAutomationAction(addRelationshipAction);
  registerAutomationAction(archiveEntityAction);
  registerAutomationAction(duplicateEntityAction);
  // v2.0 Checkpoint 39 addendum — Workflow Studio's own Delay/Wait node.
  registerAutomationAction(delayAction);

  // Ensure the real Skill Registry is populated before reading it — mirrors `getBloomAIOverview.ts`'s own inline, idempotent registration-on-load.
  registerProposalSkill();
  registerEventOperationsBriefSkill();
  registerDailyOperationsBriefSkill();
  registerBrowseAIMemorySkill();
  registerCRMAssistantSkill();
  registerFinanceAssistantSkill();
  registerUpcomingSkills();

  for (const skill of listSkills()) {
    if (!skill.execute) continue;
    if (SKILL_IDS_WITH_BESPOKE_ACTIONS.has(skill.id)) continue;
    registerAutomationAction(
      makeRunSkillAction({
        id: runSkillFallbackActionId(skill.id),
        name: skill.name,
        description: skill.description,
        skillId: skill.id,
        category: SKILL_CATEGORY_TO_AUTOMATION_CATEGORY[skill.category],
        requiredPermissions: skill.requiredPermissions,
        minimumRole: skill.minimumRole,
      }),
    );
  }

  registered = true;
}
