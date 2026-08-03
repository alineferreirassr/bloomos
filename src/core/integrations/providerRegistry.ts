import type { ProviderCategory, ProviderDefinition } from "@/core/integrations/types";

/**
 * The Provider Registry (v2 Checkpoint 22, Step 2) — a plain `Map`-based
 * registry, deliberately the exact same shape as every other registry in
 * this codebase (`core/webhooks/eventRegistry.ts`,
 * `core/marketplace/connectorRegistry.ts`, `core/automation/actionRegistry.ts`,
 * `core/ai/skills/registry.ts`) — never a class, never a database table.
 * Built-in providers self-register from `modules/integrations/providers/`
 * via `registerBuiltinProviders()`, never populated by hand at a call site.
 */
const providers = new Map<string, ProviderDefinition>();

export function registerProvider(definition: ProviderDefinition): void {
  providers.set(definition.id, definition);
}

export function unregisterProvider(id: string): void {
  providers.delete(id);
}

export function getProvider(id: string): ProviderDefinition | undefined {
  return providers.get(id);
}

export function listProviders(): ProviderDefinition[] {
  return Array.from(providers.values());
}

export function listProvidersByCategory(category: ProviderCategory): ProviderDefinition[] {
  return listProviders().filter((provider) => provider.category === category);
}

/** Test-only: restore the registry to empty between test cases. */
export function resetProviderRegistry(): void {
  providers.clear();
}
