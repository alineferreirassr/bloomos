import type { AnyCapabilityProvider } from "@/core/integrations/sdk";

/**
 * The Provider Factory (v2 Checkpoint 22, Step 17) — the seam a future
 * checkpoint uses to register a *real* SDK implementation for a
 * `ProviderDefinition` already in the Provider Registry, without the
 * Integration Manager ever needing to know which concrete class backs
 * which provider id.
 *
 * v2 Checkpoint 23 registers the first real factory (`stripe`). Every
 * real provider is credentialed *per connection*, never a single global
 * instance — `ProviderFactoryFn` takes an optional `secret`, resolved by
 * the caller from that connection's own `IntegrationCredential`
 * (`resolveProviderSecret`) before ever reaching this factory. This file
 * never resolves a credential itself; it only constructs the SDK object
 * once the caller already has the real secret in hand.
 */
/**
 * v2 Checkpoint 43 — `accessToken` is additive, for the 4 OAuth-based
 * providers this checkpoint implements (Google Calendar, Gmail, Google
 * Drive, DocuSign). Resolved the same way `secret` always was — the
 * caller reads the connection's own `IntegrationCredential`
 * (`resolveAccessToken`) before ever reaching this factory; this file
 * never resolves a credential itself.
 */
type ProviderFactoryFn = (params?: { secret?: string; accessToken?: string }) => AnyCapabilityProvider;

const factories = new Map<string, ProviderFactoryFn>();

export function registerProviderFactory(providerId: string, factory: ProviderFactoryFn): void {
  factories.set(providerId, factory);
}

export function unregisterProviderFactory(providerId: string): void {
  factories.delete(providerId);
}

export function createProviderInstance(providerId: string, params?: { secret?: string; accessToken?: string }): AnyCapabilityProvider | null {
  const factory = factories.get(providerId);
  return factory ? factory(params) : null;
}

export function hasProviderImplementation(providerId: string): boolean {
  return factories.has(providerId);
}

/** Test-only: restore the factory registry to empty between test cases. */
export function resetProviderFactoryRegistry(): void {
  factories.clear();
}
