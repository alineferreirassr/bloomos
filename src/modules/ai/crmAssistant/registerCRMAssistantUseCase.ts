import { registerAIUseCase } from "@/core/ai/prompts/registry";
import { buildCrmAssistantPrompt, CRM_ASSISTANT_PROMPT_VERSION, CRM_ASSISTANT_SYSTEM_PROMPT } from "@/modules/ai/crmAssistant/promptBuilder";
import { crmAssistantModelOutputSchema } from "@/modules/ai/crmAssistant/schema";
import { validateCrmAssistantSemantics } from "@/modules/ai/crmAssistant/semanticValidation";
import type { CrmAssistantContext, CRMAssistantModelOutput } from "@/modules/ai/crmAssistant/types";
import type { AIMemoryEntry } from "@/types/aiMemory";
import type { MemoryContextData } from "@/core/ai/context/builders/memoryContextBuilder";

export const CRM_ASSISTANT_USE_CASE_ID = "crm.assistant";

let registered = false;

/**
 * Extracts approved memories from the optional `memory` Context
 * Orchestrator section — `[]` when the Skill's own `optionalContext:
 * ["memory"]` request came back with nothing (a fresh Workspace with no
 * memory yet). `memoryContextBuilder.ts` already filters to
 * `approvalStatus: "approved"` only, so this never needs to re-check —
 * Checkpoint 7 Step 6's "never expose rejected memories" is satisfied at
 * the source, not here.
 */
function extractRecentMemories(memorySection: unknown): AIMemoryEntry[] {
  const memoryData = memorySection as MemoryContextData | undefined;
  return memoryData?.memories ?? [];
}

/**
 * Registers the CRM Assistant as a platform use case — read-only and
 * advisory (`humanApprovalPolicy: "not_required"`), the same posture as
 * Daily Brief: it drafts a relationship-intelligence report for a human to
 * read, never sends anything, never changes any record itself. A larger
 * token budget than Daily Brief's own (`maxInputTokens: 12000`) since the
 * CRM context spans Clients/Leads/Events/Contracts/Invoices/Proposals/
 * Memory in one payload, not one workspace-wide operational rollup.
 */
export function registerCRMAssistantUseCase(): void {
  if (registered) return;
  registerAIUseCase({
    useCaseId: CRM_ASSISTANT_USE_CASE_ID,
    promptVersion: CRM_ASSISTANT_PROMPT_VERSION,
    systemInstructions: CRM_ASSISTANT_SYSTEM_PROMPT,
    buildMessages: (context) => buildCrmAssistantPrompt(context as CrmAssistantContext),
    outputSchema: crmAssistantModelOutputSchema,
    semanticValidate: (output, context) => validateCrmAssistantSemantics(output as CRMAssistantModelOutput, context as CrmAssistantContext),
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 12000, reservedOutputTokens: 3000 },
    humanApprovalPolicy: "not_required",
    // The Context Orchestrator assembles `{ crmAssistantContext, memory? }` —
    // `crmAssistantContext` unwrapped as before, plus (Checkpoint 7, Step 6)
    // whatever approved memories the optional `memory` section supplied,
    // merged in as `recentMemories` for both the model's own prompt
    // (`promptBuilder.ts`) and the assembled report's own "Recent AI
    // Recommendations" section (`assembleBrief.ts`) to use.
    composeContext: (sections) => ({
      ...(sections.crmAssistantContext as CrmAssistantContext),
      recentMemories: extractRecentMemories(sections.memory),
    }),
  });
  registered = true;
}
