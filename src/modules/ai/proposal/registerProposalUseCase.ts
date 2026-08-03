import { registerAIUseCase } from "@/core/ai/prompts/registry";
import { buildProposalPrompt, PROPOSAL_PROMPT_VERSION, PROPOSAL_SYSTEM_PROMPT } from "@/modules/ai/proposal/promptBuilder";
import { proposalModelOutputSchema } from "@/modules/ai/proposal/schema";
import { validateProposalSemantics } from "@/modules/ai/proposal/semanticValidation";
import { composeProposalContext } from "@/modules/ai/proposal/proposalContextBuilder";
import type { ClientContextData } from "@/modules/ai/contextBuilders/clientContextBuilder";
import type { EventServiceAssignmentContextItem } from "@/modules/ai/contextBuilders/eventServiceAssignmentContextBuilder";
import type { ProposalDetailsContextData } from "@/modules/ai/contextBuilders/proposalDetailsContextBuilder";
import type { ProposalContext, ProposalModelOutput } from "@/modules/ai/proposal/types";

export const PROPOSAL_USE_CASE_ID = "proposal.generate";

let registered = false;

/**
 * Registers the AI Proposal Generator as a platform use case — the second
 * real feature built on the Bloom AI platform (Checkpoint 2 built the
 * platform and migrated the first, the Event Operations Brief). Advisory
 * and never-auto-sent (`humanApprovalPolicy: "always_required"`): unlike
 * the Event Operations Brief, a Proposal is explicitly meant to eventually
 * become client-facing content, so generating (and regenerating) it is
 * gated the same way accepting it is — a human must explicitly review and
 * accept a draft before it's anything more than a draft (see
 * `generateProposalDraft.ts`/`acceptProposalDraft.ts`).
 */
export function registerProposalUseCase(): void {
  if (registered) return;
  registerAIUseCase({
    useCaseId: PROPOSAL_USE_CASE_ID,
    promptVersion: PROPOSAL_PROMPT_VERSION,
    systemInstructions: PROPOSAL_SYSTEM_PROMPT,
    buildMessages: (context) => buildProposalPrompt(context as ProposalContext),
    outputSchema: proposalModelOutputSchema,
    semanticValidate: (output, context) => validateProposalSemantics(output as ProposalModelOutput, context as ProposalContext),
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 8000, reservedOutputTokens: 2000 },
    humanApprovalPolicy: "always_required",
    // Joins the Context Orchestrator's raw `client`/`eventServiceAssignment`/
    // `proposalContext` sections (fanned out in parallel, so none can depend
    // on another's output) into the single `ProposalContext` shape both
    // `buildProposalPrompt` and `validateProposalSemantics` already expect —
    // the Checkpoint-4 Skill Resolver (`core/ai/skills/resolver.ts`) is the
    // only caller.
    composeContext: (sections) =>
      composeProposalContext(
        sections.workspace as { id: string; name: string | null },
        sections.client as ClientContextData,
        (sections.eventServiceAssignment as EventServiceAssignmentContextItem[] | undefined) ?? [],
        sections.proposalContext as ProposalDetailsContextData,
      ),
  });
  registered = true;
}
