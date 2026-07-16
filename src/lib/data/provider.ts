import { getDataMode } from "@/lib/env";

export { getDataMode } from "@/lib/env";

/**
 * The single, centralized point every module routes through if/when it
 * gains a live Supabase repository. This is intentionally the *only* place
 * `NEXT_PUBLIC_DATA_MODE` should ever be branched on for data access —
 * never scatter `if (dataMode === "supabase")` checks through pages or
 * components.
 *
 * As of this Supabase Foundation phase, no business module (Leads, Clients,
 * Events, Contracts, Finance, Documents) has a Supabase repository yet —
 * `lib/data/index.ts` remains the sole implementation for all of them,
 * called directly, unconditionally, regardless of `NEXT_PUBLIC_DATA_MODE`.
 * Only the Auth/Workspace foundation (`lib/auth/*`, `lib/supabase/*`) reads
 * live Supabase when configured. This function exists so a future module's
 * migration is a one-line call added here, not a rewrite of its call sites.
 */
export function selectRepository<TMock, TSupabase>(repositories: { mock: TMock; supabase: TSupabase }): TMock | TSupabase {
  return getDataMode() === "supabase" ? repositories.supabase : repositories.mock;
}
