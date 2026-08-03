import type { AIProvider } from "@/core/ai/types";
import {
  registerAIProviderEntry,
  getRegisteredAIProviderEntry,
  getDefaultAIProviderId,
  setDefaultAIProviderId,
} from "@/core/ai/providerRegistry";

/**
 * v1's whole public surface (`registerAIProvider`/`getAIProvider`/
 * `isAIConfigured`), preserved byte-for-byte in behavior — every existing
 * caller (`generateEventOperationsBrief.ts`, and its own test file, which
 * mocks these three functions directly) keeps working unchanged. Underneath,
 * this now delegates to the v2 multi-provider registry (`providerRegistry.ts`)
 * via one fixed id, rather than the old single-slot module variable — so
 * there is exactly one source of truth for "what providers are registered,"
 * not two registries that could drift apart.
 */
const LEGACY_PROVIDER_ID = "legacy-registered";

export function registerAIProvider(provider: AIProvider): void {
  registerAIProviderEntry({ id: LEGACY_PROVIDER_ID, provider, capabilities: ["text_generation", "structured_output"] });
  setDefaultAIProviderId(LEGACY_PROVIDER_ID);
}

export function getAIProvider(): AIProvider | undefined {
  const id = getDefaultAIProviderId();
  return id ? getRegisteredAIProviderEntry(id)?.provider : undefined;
}

export function isAIConfigured(): boolean {
  return getAIProvider() !== undefined;
}
