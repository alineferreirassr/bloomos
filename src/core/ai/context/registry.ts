import type { AIContextBuilder, AIContextSectionKey } from "@/core/ai/context/types";

const builders = new Map<AIContextSectionKey, AIContextBuilder>();

/** Registering with a `key` already in use replaces that entry — same rationale as `providerRegistry.ts`'s registration behavior. */
export function registerAIContextBuilder(builder: AIContextBuilder): void {
  builders.set(builder.key, builder);
}

export function getAIContextBuilder(key: AIContextSectionKey): AIContextBuilder | undefined {
  return builders.get(key);
}

export function listAIContextBuilders(): AIContextBuilder[] {
  return [...builders.values()];
}

/** Test-only: restore the registry to empty between test cases. */
export function resetAIContextRegistry(): void {
  builders.clear();
}
