import { registerSkill } from "@/core/ai/skills/registry";
import { runSkillCompletion } from "@/core/ai/skills/resolver";
import type { SkillDefinition } from "@/core/ai/skills/types";
import { createProposalMockAIProvider } from "@/modules/ai/proposal/mockProvider";
import { proposalModelOutputSchema } from "@/modules/ai/proposal/schema";
import { PROPOSAL_PROMPT_VERSION } from "@/modules/ai/proposal/promptBuilder";
import { PROPOSAL_USE_CASE_ID, registerProposalUseCase } from "@/modules/ai/proposal/registerProposalUseCase";

export const PROPOSAL_SKILL_ID = PROPOSAL_USE_CASE_ID;

const proposalSkill: SkillDefinition = {
  id: PROPOSAL_SKILL_ID,
  name: "Proposal Generator",
  description:
    "Drafts a structured proposal from an Event's client profile, selected services, pricing, and consultation notes — never sent or authoritative until a human accepts it.",
  category: "proposal",
  requiredPermissions: ["events.update"],
  requiredContext: ["client", "eventServiceAssignment", "proposalContext"],
  useCaseId: PROPOSAL_USE_CASE_ID,
  outputSchema: proposalModelOutputSchema,
  supportedProviders: "any",
  requiredCapabilities: ["structured_output"],
  supportsStreaming: false,
  requiresApproval: false,
  requiresReview: true,
  commandPaletteVisible: true,
  sidebarVisible: true,
  featureFlag: null,
  minimumRole: null,
  version: PROPOSAL_PROMPT_VERSION,
  estimatedLatencyMs: 4000,
  contextFactsKey: "proposalContext",
  createMockProvider: createProposalMockAIProvider,
  // Assigned below — see `registerEventOperationsBriefSkill.ts`'s identical
  // doc comment for why this can't be part of the object literal itself.
};

proposalSkill.execute = async (params) =>
  runSkillCompletion({
    skill: proposalSkill,
    workspaceId: params.workspaceId,
    workspaceName: params.workspaceName,
    userId: params.userId,
    userName: params.userName,
    refs: params.refs,
    input: params.input,
  });

let registered = false;

/**
 * Registers the Proposal Generator as a Bloom AI Skill — the proof that
 * Checkpoint 3's own real feature (not just a migrated one) fits the same
 * generic Skill contract as Event Operations Brief, with zero prompt/
 * validation/UI change (see `generateProposalDraft.ts`, now a thin wrapper
 * around this plus its own persistence/memory-proposal post-processing).
 */
export function registerProposalSkill(): void {
  if (registered) return;
  registerProposalUseCase();
  registerSkill(proposalSkill);
  registered = true;
}
