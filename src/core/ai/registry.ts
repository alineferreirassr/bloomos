import type { AIProvider } from "@/core/ai/types";

/**
 * No default provider — unlike Search's `nullSearchProvider`, there is no
 * safe "empty" AI response to fall back to (an AI feature with nothing
 * registered should fail loudly, not silently pretend to answer). A future
 * OpenAI/Anthropic adapter package calls `registerAIProvider` at its own
 * module-init time; until then `getAIProvider()` returns `undefined` and
 * callers are expected to treat that as "Bloom AI isn't configured yet."
 */
let activeProvider: AIProvider | undefined;

export function registerAIProvider(provider: AIProvider): void {
  activeProvider = provider;
}

export function getAIProvider(): AIProvider | undefined {
  return activeProvider;
}

export function isAIConfigured(): boolean {
  return activeProvider !== undefined;
}
