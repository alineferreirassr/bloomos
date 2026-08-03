import type { FeatureFlag } from "@/types/featureFlag";
import type { DataResult } from "@/lib/data/result";

/**
 * The single Feature Flags persistence contract — same repository pattern
 * as every business module. Mock-only this phase (no `supabaseRepository.ts`,
 * no migration) — same rationale `core/tags`/`core/comments`/`core/audit`
 * already established: build the architecture ahead of any real feature
 * that needs to gate on it, without a live table nothing yet queries. A
 * live migration is the natural next step once Phase 2's Multi-Workspace
 * rollout needs to progressively enable a real module for one Workspace
 * at a time — not invented speculatively here.
 */
export interface FeatureFlagsRepository {
  listFeatureFlags(workspaceId: string): Promise<FeatureFlag[]>;
  isFeatureEnabled(workspaceId: string, key: string): Promise<boolean>;
  setFeatureFlag(workspaceId: string, key: string, enabled: boolean): Promise<DataResult<FeatureFlag>>;
}
