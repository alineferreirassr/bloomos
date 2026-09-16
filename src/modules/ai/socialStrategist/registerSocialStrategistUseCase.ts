import { registerAIUseCase } from "@/core/ai/prompts/registry";
import { buildSocialStrategistPrompt, SOCIAL_STRATEGIST_PROMPT_VERSION, SOCIAL_STRATEGIST_SYSTEM_INSTRUCTIONS } from "@/modules/ai/socialStrategist/promptBuilder";
import { socialStrategistModelOutputSchema } from "@/modules/ai/socialStrategist/schema";
import { validateSocialStrategistSemantics } from "@/modules/ai/socialStrategist/semanticValidation";
import type { SocialStrategistContext, SocialStrategistModelOutput } from "@/modules/ai/socialStrategist/types";

export const SOCIAL_STRATEGIST_USE_CASE_ID = "social.strategist";

let registered = false;

/**
 * Registers the Social Strategist as a platform use case — read-only and
 * advisory (`humanApprovalPolicy: "not_required"`), the same posture as
 * CRM Assistant/Daily Brief: it drafts a strategy report for a human to
 * read, never publishes, schedules, or sends anything, never changes any
 * record itself. `composeContext` is the identity unwrap of the one
 * `socialStrategistContext` section — no `memory` merge this checkpoint
 * (kept out of scope; a future checkpoint can add `optionalContext:
 * ["memory"]` the same way CRM Assistant did, without touching this file's
 * own shape).
 */
export function registerSocialStrategistUseCase(): void {
  if (registered) return;
  registerAIUseCase({
    useCaseId: SOCIAL_STRATEGIST_USE_CASE_ID,
    promptVersion: SOCIAL_STRATEGIST_PROMPT_VERSION,
    systemInstructions: SOCIAL_STRATEGIST_SYSTEM_INSTRUCTIONS,
    buildMessages: (context) => buildSocialStrategistPrompt(context as SocialStrategistContext),
    outputSchema: socialStrategistModelOutputSchema,
    semanticValidate: (output, context) => validateSocialStrategistSemantics(output as SocialStrategistModelOutput, context as SocialStrategistContext),
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 12000, reservedOutputTokens: 3000 },
    humanApprovalPolicy: "not_required",
    composeContext: (sections) => sections.socialStrategistContext as SocialStrategistContext,
  });
  registered = true;
}
