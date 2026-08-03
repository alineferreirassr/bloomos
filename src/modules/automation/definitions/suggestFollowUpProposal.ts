import { GENERATE_PROPOSAL_ACTION_ID } from "@/modules/automation/actions/generateProposalAction";
import type { AutomationDefinition } from "@/types/automation";

export const SUGGEST_FOLLOW_UP_PROPOSAL_ID = "suggest-follow-up-proposal";

/**
 * Example Automation #3 — `role_restricted` approval (`minimumApproverRole:
 * "manager"`): approval is always required for this one, *and* only a
 * Manager or Owner may actually grant it. Also **live-wired**, listening to
 * the same `proposal.rejected` trigger as
 * `recordMemoryOnProposalRejection.ts` — proving one trigger fans out to
 * more than one Automation. Generating a brand-new Proposal draft costs a
 * real AI call and represents new client-facing content, unlike simply
 * recording a memory — human approval earns its keep here.
 */
const suggestFollowUpProposal: AutomationDefinition = {
  id: SUGGEST_FOLLOW_UP_PROPOSAL_ID,
  name: "Suggest Follow-Up Proposal on Rejection",
  description: "Suggests generating a revised Proposal draft after a rejection — requires a Manager or Owner's explicit approval before it runs.",
  category: "proposal",
  version: "automation-def-suggest-follow-up-proposal-v1",
  status: "active",
  trigger: "proposal.rejected",
  conditions: [],
  actionIds: [GENERATE_PROPOSAL_ACTION_ID],
  approvalPolicy: { kind: "role_restricted", minimumApproverRole: "manager" },
  requiredPermissions: ["events.update"],
  featureFlag: null,
  minimumRole: null,
  maxRetries: 0,
};

export default suggestFollowUpProposal;
