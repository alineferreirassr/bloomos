import { registerAIUseCase } from "@/core/ai/prompts/registry";
import { buildFinanceAssistantPrompt, FINANCE_ASSISTANT_PROMPT_VERSION, FINANCE_ASSISTANT_SYSTEM_PROMPT } from "@/modules/ai/financeAssistant/promptBuilder";
import { financeAssistantModelOutputSchema } from "@/modules/ai/financeAssistant/schema";
import { validateFinanceAssistantSemantics } from "@/modules/ai/financeAssistant/semanticValidation";
import type { FinanceAssistantContext, FinanceAssistantModelOutput, FinanceAssistantCrmRecommendation } from "@/modules/ai/financeAssistant/types";
import type { AIMemoryEntry } from "@/types/aiMemory";
import type { MemoryContextData } from "@/core/ai/context/builders/memoryContextBuilder";
import type { CrmAssistantContext } from "@/modules/ai/crmAssistant/types";

export const FINANCE_ASSISTANT_USE_CASE_ID = "finance.assistant";

let registered = false;

/**
 * Extracts approved memories from the optional `memory` Context
 * Orchestrator section — `[]` when the Skill's own `optionalContext`
 * request came back with nothing. `memoryContextBuilder.ts` already
 * filters to `approvalStatus: "approved"` only, so this never needs to
 * re-check — Checkpoint 8 Step 6's "never expose rejected memories" is
 * satisfied at the source, not here.
 */
function extractRecentMemories(memorySection: unknown): AIMemoryEntry[] {
  const memoryData = memorySection as MemoryContextData | undefined;
  return memoryData?.memories ?? [];
}

/**
 * Checkpoint 8, Step 2's "CRM recommendations" — reuses whatever the
 * optional `crmAssistantContext` section (Checkpoint 7) supplied, rather
 * than duplicating CRM Assistant's own client-risk detection. `undefined`
 * (a fresh Workspace, or a member without `clients.view`) is treated the
 * same as "no recommendations" — additive enrichment, never a dependency.
 */
function extractCrmRecommendations(crmSection: unknown): FinanceAssistantCrmRecommendation[] {
  const crmContext = crmSection as CrmAssistantContext | undefined;
  if (!crmContext) return [];
  return crmContext.clientsAtRisk.map((risk) => ({ clientId: risk.clientId, name: risk.name, reasons: risk.reasons }));
}

/**
 * Registers the Finance Assistant as a platform use case — read-only and
 * advisory (`humanApprovalPolicy: "not_required"`), the same posture as
 * Daily Brief/CRM Assistant: it drafts a financial-intelligence report for
 * a human to read, never moves money or changes any record itself. A
 * larger token budget than Daily Brief's own, matching CRM Assistant's,
 * since the Finance context spans Invoices/Payments/Contracts/Proposals/
 * Events/Memory/CRM in one payload.
 */
export function registerFinanceAssistantUseCase(): void {
  if (registered) return;
  registerAIUseCase({
    useCaseId: FINANCE_ASSISTANT_USE_CASE_ID,
    promptVersion: FINANCE_ASSISTANT_PROMPT_VERSION,
    systemInstructions: FINANCE_ASSISTANT_SYSTEM_PROMPT,
    buildMessages: (context) => buildFinanceAssistantPrompt(context as FinanceAssistantContext),
    outputSchema: financeAssistantModelOutputSchema,
    semanticValidate: (output, context) => validateFinanceAssistantSemantics(output as FinanceAssistantModelOutput, context as FinanceAssistantContext),
    requiredCapabilities: ["structured_output"],
    tokenBudget: { maxInputTokens: 12000, reservedOutputTokens: 3000 },
    humanApprovalPolicy: "not_required",
    // The Context Orchestrator assembles `{ financeAssistantContext, memory?,
    // crmAssistantContext? }` — `financeAssistantContext` unwrapped as
    // before, plus (Checkpoint 8, Step 6) whatever approved memories the
    // optional `memory` section supplied, merged in as `recentMemories`,
    // and (Step 2's "CRM recommendations") whatever the optional
    // `crmAssistantContext` section supplied, merged in as
    // `crmRecommendations` — the first time one Skill's own composite
    // context section is itself consumed, optionally, by a different Skill.
    composeContext: (sections) => ({
      ...(sections.financeAssistantContext as FinanceAssistantContext),
      recentMemories: extractRecentMemories(sections.memory),
      crmRecommendations: extractCrmRecommendations(sections.crmAssistantContext),
    }),
  });
  registered = true;
}
