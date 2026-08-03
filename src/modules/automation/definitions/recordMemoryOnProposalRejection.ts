import { CREATE_MEMORY_ACTION_ID } from "@/modules/automation/actions/createMemoryAction";
import type { AutomationDefinition } from "@/types/automation";

export const RECORD_MEMORY_ON_PROPOSAL_REJECTION_ID = "record-memory-on-proposal-rejection";

/**
 * Example Automation #2 — `never_required` approval. This one is genuinely
 * **live-wired**: `rejectProposalDraft.ts` dispatches a real
 * `proposal.rejected` trigger after every real rejection, and this
 * Automation actually runs, recording a real Memory entry — proving the
 * full pipeline end to end, not just under a test's own direct call.
 * Recording a fact carries no risk a human needs to gate, matching
 * Daily Brief's own precedent of auto-approving a `"system"`-sourced
 * memory with no model judgment involved.
 */
const recordMemoryOnProposalRejection: AutomationDefinition = {
  id: RECORD_MEMORY_ON_PROPOSAL_REJECTION_ID,
  name: "Record Memory on Proposal Rejection",
  description: "Records a structured memory entry noting that a Proposal draft was rejected.",
  category: "memory",
  version: "automation-def-memory-on-proposal-rejection-v1",
  status: "active",
  trigger: "proposal.rejected",
  conditions: [],
  actionIds: [CREATE_MEMORY_ACTION_ID],
  approvalPolicy: { kind: "never_required" },
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  maxRetries: 0,
};

export default recordMemoryOnProposalRejection;
