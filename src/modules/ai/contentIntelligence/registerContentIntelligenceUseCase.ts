import { registerAIUseCase } from "@/core/ai/prompts/registry";
import { buildContentIntelligencePrompt, CONTENT_INTELLIGENCE_USE_CASE_ID, CONTENT_INTELLIGENCE_PROMPT_VERSION, CONTENT_INTELLIGENCE_SYSTEM_INSTRUCTIONS } from "@/modules/ai/contentIntelligence/promptBuilder";
import { contentIntelligenceBriefOutputSchema } from "@/modules/ai/contentIntelligence/schema";
import type { ContentIntelligenceSourceContent } from "@/modules/ai/contentIntelligence/types";

let registered = false;

/**
 * Registers the Content Intelligence Brief as a platform use case through
 * the shared Prompt Registry (`core/ai/prompts/registry.ts`) — the same
 * registration seam `registerEventOperationsBriefUseCase` established,
 * mirrored exactly, including the idempotent module-level guard. This
 * checkpoint deliberately does not also wrap it as a `SkillDefinition`
 * (`core/ai/skills/`): the Skill layer's own value — cross-cutting Context
 * Orchestrator composition, command-palette/sidebar discovery metadata,
 * role/feature-flag gating for a future Bloom AI Dashboard — doesn't apply
 * here, since this checkpoint builds no UI and gates permissions directly
 * in `analyzeContentAction.ts` the same way every other Social Server
 * Action already does (`social.view`/`social.create`). Going through the
 * Skill layer would also require extending the global
 * `AI_CONTEXT_SECTION_KEYS` enum and registering a new cross-cutting
 * Context Orchestrator builder for a section ("one Idea/Inspiration/
 * Script's own content") that composes with nothing else — a wider,
 * unjustified blast radius for a capability that only ever needs one
 * already-known, already-fetched record's own fields. `runSkillCompletion`
 * remains available unchanged for a future checkpoint that does need
 * cross-cutting context composition or Bloom AI Dashboard discovery.
 */
export function registerContentIntelligenceUseCase(): void {
  if (registered) return;
  registerAIUseCase({
    useCaseId: CONTENT_INTELLIGENCE_USE_CASE_ID,
    promptVersion: CONTENT_INTELLIGENCE_PROMPT_VERSION,
    systemInstructions: CONTENT_INTELLIGENCE_SYSTEM_INSTRUCTIONS,
    buildMessages: (context) => buildContentIntelligencePrompt(context as ContentIntelligenceSourceContent),
    outputSchema: contentIntelligenceBriefOutputSchema,
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 6000, reservedOutputTokens: 1200 },
    // Advisory content suggestions that could inform client-facing copy —
    // kept conservative per PRODUCT_PRINCIPLES.md #4, even though nothing
    // in this checkpoint ever applies a suggestion automatically regardless
    // of this flag's value (there is no "apply" action at all yet).
    humanApprovalPolicy: "always_required",
  });
  registered = true;
}
