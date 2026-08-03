import type { AIProvider } from "@/core/ai/types";
import type { AICapability } from "@/core/ai/capabilities";

export type AIProviderAvailability = "available" | "unavailable" | "degraded";

export interface AIProviderHealth {
  availability: AIProviderAvailability;
  lastCheckedAt?: string;
  lastError?: string;
}

/**
 * A provider plus the metadata provider *selection* needs — `AIProvider`
 * itself (`core/ai/types.ts`) stays a pure "how to call it" contract, since
 * that's the seam a real adapter package implements; everything about
 * *which* provider to pick for a given request lives here instead.
 */
export interface RegisteredAIProvider {
  id: string;
  provider: AIProvider;
  capabilities: AICapability[];
  health: AIProviderHealth;
}

export interface RegisterAIProviderInput {
  id: string;
  provider: AIProvider;
  capabilities: AICapability[];
}

const providers = new Map<string, RegisteredAIProvider>();
let defaultProviderId: string | undefined;

/** Registering with an `id` already in use replaces that entry — matches the "registration and removal" requirement without needing a separate update function. */
export function registerAIProviderEntry(input: RegisterAIProviderInput): void {
  providers.set(input.id, {
    id: input.id,
    provider: input.provider,
    capabilities: input.capabilities,
    health: { availability: "available" },
  });
}

export function unregisterAIProviderEntry(id: string): void {
  providers.delete(id);
  if (defaultProviderId === id) defaultProviderId = undefined;
}

export function getRegisteredAIProviderEntry(id: string): RegisteredAIProvider | undefined {
  return providers.get(id);
}

export function listRegisteredAIProviders(): RegisteredAIProvider[] {
  return [...providers.values()];
}

export function setDefaultAIProviderId(id: string): void {
  defaultProviderId = id;
}

export function getDefaultAIProviderId(): string | undefined {
  return defaultProviderId;
}

export function setAIProviderHealth(id: string, health: AIProviderHealth): void {
  const entry = providers.get(id);
  if (!entry) return;
  providers.set(id, { ...entry, health });
}

/** Test-only: restore the registry to empty between test cases. */
export function resetAIProviderRegistry(): void {
  providers.clear();
  defaultProviderId = undefined;
}

function isCandidateEligible(entry: RegisteredAIProvider | undefined, requiredCapabilities: AICapability[]): entry is RegisteredAIProvider {
  if (!entry) return false;
  if (entry.health.availability === "unavailable") return false;
  return requiredCapabilities.every((capability) => entry.capabilities.includes(capability));
}

export interface SelectAIProviderOptions {
  requiredCapabilities?: AICapability[];
  preferredProviderId?: string;
  fallbackProviderIds?: string[];
}

/**
 * Returns an ordered, de-duplicated candidate list — preferred first (if
 * eligible), then the explicit fallback chain in order (each if eligible),
 * then the registered default (if eligible and not already included).
 * Never includes an `unavailable` provider; a `degraded` one is still
 * offered (it's a candidate worth trying, just a lower-confidence one —
 * distinct from `unavailable`, which is a hard exclusion).
 */
export function selectAIProviders(options: SelectAIProviderOptions = {}): RegisteredAIProvider[] {
  const requiredCapabilities = options.requiredCapabilities ?? [];
  const seen = new Set<string>();
  const candidates: RegisteredAIProvider[] = [];

  function tryAdd(id: string | undefined) {
    if (!id || seen.has(id)) return;
    const entry = getRegisteredAIProviderEntry(id);
    if (isCandidateEligible(entry, requiredCapabilities)) {
      candidates.push(entry);
      seen.add(id);
    }
  }

  tryAdd(options.preferredProviderId);
  for (const id of options.fallbackProviderIds ?? []) tryAdd(id);
  tryAdd(defaultProviderId);

  return candidates;
}
