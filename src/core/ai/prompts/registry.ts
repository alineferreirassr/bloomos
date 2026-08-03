import type { AIUseCaseDefinition } from "@/core/ai/prompts/types";

const useCases = new Map<string, AIUseCaseDefinition>();

export function registerAIUseCase(definition: AIUseCaseDefinition): void {
  useCases.set(definition.useCaseId, definition);
}

export function getAIUseCase(useCaseId: string): AIUseCaseDefinition | undefined {
  return useCases.get(useCaseId);
}

export function listAIUseCases(): AIUseCaseDefinition[] {
  return [...useCases.values()];
}

/** Test-only: restore the registry to empty between test cases. */
export function resetAIUseCaseRegistry(): void {
  useCases.clear();
}
