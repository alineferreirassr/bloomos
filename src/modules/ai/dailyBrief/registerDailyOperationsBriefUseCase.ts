import { registerAIUseCase } from "@/core/ai/prompts/registry";
import { buildDailyOperationsBriefPrompt, DAILY_OPERATIONS_BRIEF_PROMPT_VERSION, DAILY_OPERATIONS_BRIEF_SYSTEM_PROMPT } from "@/modules/ai/dailyBrief/promptBuilder";
import { dailyOperationsBriefModelOutputSchema } from "@/modules/ai/dailyBrief/schema";
import { validateDailyOperationsBriefSemantics } from "@/modules/ai/dailyBrief/semanticValidation";
import type { DailyOperationsBriefContext, DailyOperationsBriefModelOutput, DailyBriefIssueSnapshot } from "@/modules/ai/dailyBrief/types";
import type { MemoryContextData } from "@/core/ai/context/builders/memoryContextBuilder";

export const DAILY_OPERATIONS_BRIEF_USE_CASE_ID = "daily.operations.brief";

let registered = false;

/**
 * Extracts the most recent prior Daily Brief's own issue snapshot from the
 * optional `memory` Context Orchestrator section — `undefined` when the
 * Skill's own `optionalContext: ["memory"]` request came back with nothing
 * (this Workspace's very first Daily Brief, or the memory category
 * genuinely has no entries yet). A memory whose `summary` isn't valid JSON
 * (should never happen for a `"system"`-sourced entry this feature itself
 * wrote, but a human could in principle edit one) is treated the same as
 * "no snapshot" rather than thrown — Step 7 is additive, never a hard
 * dependency.
 */
function extractPreviousSnapshot(memorySection: unknown): DailyBriefIssueSnapshot[] | null {
  const memoryData = memorySection as MemoryContextData | undefined;
  const mostRecent = memoryData?.memories[0];
  if (!mostRecent) return null;
  try {
    const parsed = JSON.parse(mostRecent.summary);
    return Array.isArray(parsed) ? (parsed as DailyBriefIssueSnapshot[]) : null;
  } catch {
    return null;
  }
}

/**
 * Registers the Daily Operations Brief as a platform use case — read-only
 * and advisory (`humanApprovalPolicy: "not_required"`), the same posture as
 * the Event Operations Brief: it drafts a workspace-wide briefing for a
 * human to read, never sends anything or changes any record itself.
 */
export function registerDailyOperationsBriefUseCase(): void {
  if (registered) return;
  registerAIUseCase({
    useCaseId: DAILY_OPERATIONS_BRIEF_USE_CASE_ID,
    promptVersion: DAILY_OPERATIONS_BRIEF_PROMPT_VERSION,
    systemInstructions: DAILY_OPERATIONS_BRIEF_SYSTEM_PROMPT,
    buildMessages: (context) => buildDailyOperationsBriefPrompt(context as DailyOperationsBriefContext),
    outputSchema: dailyOperationsBriefModelOutputSchema,
    semanticValidate: (output, context) =>
      validateDailyOperationsBriefSemantics(output as DailyOperationsBriefModelOutput, context as DailyOperationsBriefContext),
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 8000, reservedOutputTokens: 2000 },
    humanApprovalPolicy: "not_required",
    // The Context Orchestrator assembles `{ dailyBriefContext, memory? }` —
    // `dailyBriefContext` unwrapped as before, plus (Checkpoint 6, Step 7)
    // whatever prior issue snapshot the optional `memory` section supplied,
    // merged in as `previousSnapshot` for `assembleBrief.ts` to diff
    // against deterministically. The Skill Resolver
    // (`core/ai/skills/resolver.ts`) is the only caller.
    composeContext: (sections) => ({
      ...(sections.dailyBriefContext as DailyOperationsBriefContext),
      previousSnapshot: extractPreviousSnapshot(sections.memory),
    }),
  });
  registered = true;
}
