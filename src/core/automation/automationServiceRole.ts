import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * SOCIAL-11B — a new, deliberately narrow service-role boundary for the
 * automation idempotency ledger only, mirroring
 * `src/core/social/socialSchedulerServiceRole.ts`'s own exact shape and its
 * own explicit reasoning for not being a shared/generic helper: this is a
 * new, automation-idempotency-only module, not a rewrite of that one or a
 * third copy of `trustedReconciliation.ts`'s DocuSign-only original. The
 * `automation_idempotency_keys` table's own RLS has zero policies by
 * design (internal system infrastructure — see the migration's own header
 * comment), so the two claim/complete RPCs it backs can only ever be
 * called through a service-role client, never the ordinary session-bound
 * one every other repository in this codebase uses.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";

/** Lazy, never module-scoped — mirrors `socialSchedulerServiceRole.ts`'s own "re-read on every access, never throw at import time" discipline. The service-role key is never logged, returned, or included in any error message. */
export function createAutomationServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getPublicEnv();
  const serviceRoleKey = process.env[SERVICE_ROLE_ENV_VAR]?.trim();
  if (!env.supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
