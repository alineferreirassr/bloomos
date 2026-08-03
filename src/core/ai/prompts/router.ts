import { getAIUseCase } from "@/core/ai/prompts/registry";
import type { AIUseCaseDefinition } from "@/core/ai/prompts/types";
import type { AIError } from "@/core/ai/errors";

export type RouteAIUseCaseResult = { success: true; useCase: AIUseCaseDefinition } | { success: false; error: AIError };

/** Resolves a registered use case by id — the one place "is this a real, registered AI feature" is decided, so a typo'd or not-yet-migrated `useCaseId` fails with a clear, typed error instead of a crash deep in the runtime. */
export function routeAIUseCase(useCaseId: string): RouteAIUseCaseResult {
  const useCase = getAIUseCase(useCaseId);
  if (!useCase) {
    return { success: false, error: { category: "invalid_request", message: `No AI use case is registered for "${useCaseId}".` } };
  }
  return { success: true, useCase };
}
