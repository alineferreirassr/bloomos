import { getDataMode } from "@/lib/env";

export { getDataMode } from "@/lib/env";

/**
 * The single, centralized point every module routes through to select
 * between its mock and Supabase repositories. This is intentionally the
 * *only* place `NEXT_PUBLIC_DATA_MODE` should ever be branched on for data
 * access — never scatter `if (dataMode === "supabase")` checks through
 * pages or components.
 *
 * Every Phase 1 MVP business module (Leads, Clients, Events, Contracts,
 * Finance, Documents) plus the Shared Media Library has both a mock and a
 * Supabase repository, each implementing the same interface, both wired
 * through this function inside `lib/data/index.ts`'s thin wrapper
 * functions. `NEXT_PUBLIC_DATA_MODE=mock` (the default) selects the mock
 * repository for every module, including Auth/Workspace; `=supabase`
 * selects the Supabase repository for every module. This function exists
 * so a future module's migration is a one-line call added here, not a
 * rewrite of its call sites.
 */
export function selectRepository<TMock, TSupabase>(repositories: { mock: TMock; supabase: TSupabase }): TMock | TSupabase {
  return getDataMode() === "supabase" ? repositories.supabase : repositories.mock;
}
