import { registerAIUseCase } from "@/core/ai/prompts/registry";
import { buildEventOperationsBriefPrompt, EVENT_OPERATIONS_BRIEF_PROMPT_VERSION, EVENT_OPERATIONS_BRIEF_SYSTEM_PROMPT } from "@/modules/ai/promptBuilder";
import { eventOperationsBriefModelOutputSchema } from "@/modules/ai/schema";
import type { EventOperationsBriefContext } from "@/modules/ai/types";

export const EVENT_OPERATIONS_BRIEF_USE_CASE_ID = "event-operations-brief";

let registered = false;

/**
 * Registers the Event Operations Brief as a platform use case — this is the
 * proof that a real, previously feature-specific AI flow can run through
 * the shared Prompt Registry rather than each feature wiring its own
 * prompt/schema plumbing. `buildMessages`' `input` parameter is unused: this
 * use case has nothing beyond the assembled context to feed the model.
 * Read-only and advisory (`humanApprovalPolicy: "not_required"`) — it drafts
 * a brief for a human to review, never sends anything or changes Event
 * state itself, matching `PRODUCT_PRINCIPLES.md` #4.
 */
export function registerEventOperationsBriefUseCase(): void {
  if (registered) return;
  registerAIUseCase({
    useCaseId: EVENT_OPERATIONS_BRIEF_USE_CASE_ID,
    promptVersion: EVENT_OPERATIONS_BRIEF_PROMPT_VERSION,
    systemInstructions: EVENT_OPERATIONS_BRIEF_SYSTEM_PROMPT,
    buildMessages: (context) => buildEventOperationsBriefPrompt(context as EventOperationsBriefContext),
    outputSchema: eventOperationsBriefModelOutputSchema,
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 8000, reservedOutputTokens: 1500 },
    humanApprovalPolicy: "not_required",
    // The Context Orchestrator only ever assembles the raw, section-keyed
    // bag (`{ event, workspace, user }`); this use case's own prompt/output
    // shape is just the single `event` section, unwrapped — the Checkpoint-4
    // Skill Resolver (`core/ai/skills/resolver.ts`) is the only caller.
    composeContext: (sections) => sections.event as EventOperationsBriefContext,
  });
  registered = true;
}
