import type { FeatureFlagsRepository } from "@/lib/data/core/featureFlags/repository";
import { mockFeatureFlagsRepository } from "@/lib/data/core/featureFlags/mockRepository";
import { hasLocalFeatureFlagOverride } from "@/core/featureFlags/localOverride";

/** Mock-only this phase — same seam every other Core domain uses (`getCoreNotificationsService`, etc.); swaps to a real repository once a live table exists. */
export function getCoreFeatureFlagsService(): FeatureFlagsRepository {
  return mockFeatureFlagsRepository;
}

/**
 * The one function anything gating on a flag should call — "server
 * evaluation" in the sense that it's the single, authoritative place a
 * flag's value is decided, callable from a Server Component/Action just as
 * well as a Client Component. A local override always wins in development,
 * regardless of what's actually stored, so an engineer can force a flag on
 * without needing a live table to write to yet.
 */
export async function evaluateFeatureFlag(workspaceId: string, key: string): Promise<boolean> {
  if (hasLocalFeatureFlagOverride(key)) return true;
  return getCoreFeatureFlagsService().isFeatureEnabled(workspaceId, key);
}
