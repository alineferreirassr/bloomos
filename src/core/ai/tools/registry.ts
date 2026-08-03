import type { AIToolDefinition } from "@/core/ai/tools/types";

const tools = new Map<string, AIToolDefinition>();

/** Registering with a `toolId` already in use replaces that entry — same rationale as every other registry in `core/ai`. */
export function registerAITool(definition: AIToolDefinition): void {
  tools.set(definition.toolId, definition);
}

export function getAITool(toolId: string): AIToolDefinition | undefined {
  return tools.get(toolId);
}

export function listAITools(): AIToolDefinition[] {
  return [...tools.values()];
}

/** Test-only: restore the registry to empty between test cases. */
export function resetAIToolRegistry(): void {
  tools.clear();
}
