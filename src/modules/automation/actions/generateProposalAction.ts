import { generateProposalDraft } from "@/modules/ai/proposal/generateProposalDraft";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const GENERATE_PROPOSAL_ACTION_ID = "generate-proposal";

/**
 * A genuine, working action — calls `generateProposalDraft()` directly,
 * the exact same "use server" wrapper the Proposal Generator's own UI
 * calls, which itself resolves the *current request's own* active member
 * session and runs the full `executeSkill()` pipeline. This is safe
 * specifically because this checkpoint's own non-goals ("do not execute
 * automatically from external webhooks," "do not implement scheduled
 * execution") mean every Automation this checkpoint actually dispatches
 * fires synchronously within a real, already-authenticated request — never
 * from a detached background job with no session to resolve.
 */
const generateProposalAction: AutomationActionDefinition = {
  id: GENERATE_PROPOSAL_ACTION_ID,
  name: "Generate Proposal",
  description: "Runs the Proposal Generator Skill for a given Event, through executeSkill().",
  category: "proposal",
  version: "automation-action-generate-proposal-v1",
  requiredPermissions: ["events.update"],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const eventId = params.facts.eventId;
    if (typeof eventId !== "string") {
      return { success: false, message: "Missing eventId in the trigger's own facts." };
    }
    const parentProposalId = typeof params.facts.parentProposalId === "string" ? params.facts.parentProposalId : null;

    const result = await generateProposalDraft(eventId, parentProposalId);
    if (!result.success) return { success: false, message: result.error };
    return { success: true, message: `Proposal draft v${result.data.version} generated.`, resultRef: { type: "proposal", id: result.data.id } };
  },
};

export default generateProposalAction;
