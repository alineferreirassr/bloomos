import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * MEDIAKIT-04 — a new, narrow service-role boundary for the PUBLIC
 * `/m/[slug]` page only, mirroring `automationServiceRole.ts`'s own exact
 * shape and reasoning. `media-assets` is a private Supabase Storage bucket
 * (`supabase/migrations/20260719100100_media_assets_bucket_and_storage_policies.sql`)
 * whose RLS policies are `to authenticated` only — a genuinely anonymous
 * public visitor has no session at all, so the ordinary session-bound
 * client can never resolve a signed URL there. This client is used
 * exclusively to resolve display URLs for `media_asset_id`s that already
 * came from a real published Media Kit snapshot (never an arbitrary
 * caller-supplied id), and to invoke `record_media_kit_inquiry_event`
 * (service_role-only grant) — never for anything else.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";

/** Lazy, never module-scoped — mirrors `automationServiceRole.ts`'s own "re-read on every access, never throw at import time" discipline. The key is never logged, returned, or included in any error message. */
export function createMediaKitServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getPublicEnv();
  const serviceRoleKey = process.env[SERVICE_ROLE_ENV_VAR]?.trim();
  if (!env.supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
