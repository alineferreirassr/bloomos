import type { ZodType } from "zod";
import type { AIPrompt } from "@/core/ai/types";
import type { AICapability } from "@/core/ai/capabilities";
import type { TokenBudgetConfig } from "@/core/ai/tokenBudget";

export type AIHumanApprovalPolicy = "always_required" | "not_required";

/**
 * Everything one AI feature needs to run through the platform, registered
 * once. `buildMessages` stays owned by the feature's own module (e.g.
 * `modules/ai/promptBuilder.ts`) — this registry holds a *pointer* to it,
 * not the prompt text itself, so `core/ai` never becomes a place prompt
 * strings accumulate. Generic parameters are intentionally erased to
 * `unknown` at the registry boundary (a heterogeneous `Map` can't preserve
 * per-entry generics) — `getAIUseCase`'s caller casts back to its own
 * concrete types, the same trade-off `core/search`'s registry makes for
 * `SearchableEntityConfig`.
 */
export interface AIUseCaseDefinition {
  useCaseId: string;
  promptVersion: string;
  systemInstructions: string;
  buildMessages: (context: unknown, input: unknown) => AIPrompt[];
  outputSchema: ZodType;
  semanticValidate?: (output: unknown, context: unknown) => { success: true; value: unknown } | { success: false; error: string };
  requiredCapabilities: AICapability[];
  preferredProviderId?: string;
  fallbackProviderIds?: string[];
  tokenBudget: TokenBudgetConfig;
  /** BloomOS's permanent rule (`PRODUCT_PRINCIPLES.md` #4) as a type-level default: every use case must declare this explicitly, and anything client-facing/financial/contractual/status-changing must declare `"always_required"`. */
  humanApprovalPolicy: AIHumanApprovalPolicy;
  /**
   * Turns the Context Orchestrator's raw, section-keyed assembly
   * (`AIContextAssemblyResult.sections`, e.g. `{ event, client, workspace }`)
   * into whatever single shape this use case's own `buildMessages`/
   * `semanticValidate` actually expect — this is where a feature's own
   * `composeXContext` helper (e.g. `composeProposalContext`) plugs in.
   * Optional and defaults to identity (the raw sections record passed
   * straight through) for a use case simple enough not to need it — see
   * `core/ai/skills/resolver.ts`, the only caller.
   */
  composeContext?: (sections: Record<string, unknown>) => unknown;
}
