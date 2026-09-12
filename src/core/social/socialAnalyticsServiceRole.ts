import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * SOCIAL-05D — BloomOS's third narrow, Social-scoped service-role
 * boundary (the first is `trustedReconciliation.ts`'s DocuSign-only one,
 * the second `socialSchedulerServiceRole.ts`'s publish-scheduling-only
 * one — SOCIAL-04A's own audit explicitly rejected refactoring either into
 * a shared generic helper "merely to share code," and that precedent
 * applies here too: this duplicates the same small
 * `createServiceRoleClient`/vault-secret-reading shape rather than
 * importing it from the scheduler's own file, which stays scoped to
 * publishing).
 *
 * The analytics sync (`socialAnalyticsSyncExecutor.ts`, invoked only from
 * a CRON_SECRET-protected route with no browser session) has no
 * `auth.uid()`, so it cannot satisfy `integration_connections`/
 * `integration_credentials`' own RLS policies through the ordinary
 * session-bound client. This module is the one place that bypasses RLS
 * via the service-role key to read what the sync needs — every query here
 * explicitly re-checks `workspace_id` (SOCIAL-05A/05C's own explicit
 * contract: RLS bypass must never imply cross-workspace trust). Nothing
 * here is exported beyond what the executor needs. The service-role key
 * and every resolved access token are never logged, returned, or included
 * in any error message.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";
const ANALYTICS_SCOPE = "instagram_manage_insights";

/** Lazy, never module-scoped — mirrors every other service-role boundary in this codebase's own "re-read on every access, never throw at import time" discipline. */
export function createServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getPublicEnv();
  const serviceRoleKey = process.env[SERVICE_ROLE_ENV_VAR]?.trim();
  if (!env.supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveVaultSecret(supabase: SupabaseClient<Database>, secretId: string): Promise<string | null> {
  // Same technique as socialSchedulerServiceRole.ts's own resolveVaultSecret
  // (and trustedReconciliation.ts's before it): vault.decrypted_secrets is
  // outside the typed `public` schema and restricted to a privileged
  // (service_role) connection, which this already is.
  const untyped = supabase as unknown as SupabaseClient;
  const { data, error } = await untyped.schema("vault").from("decrypted_secrets").select("decrypted_secret").eq("id", secretId).maybeSingle();
  if (error || !data || typeof (data as { decrypted_secret?: unknown }).decrypted_secret !== "string") return null;
  return (data as { decrypted_secret: string }).decrypted_secret;
}

export interface WorkspaceAnalyticsContext {
  connectionId: string;
  /** From the connection's own config — null when no Instagram identity has been selected yet (account-level sync is skipped, not failed, in that case). */
  instagramAccountId: string | null;
  accessToken: string;
}

export type ResolveWorkspaceAnalyticsContextResult =
  | { success: true; context: WorkspaceAnalyticsContext }
  | { success: false; reason: "service_role_unavailable" | "connection" | "credential" };

/**
 * Resolves everything one workspace's analytics sync needs — the Meta
 * access token and the selected Instagram account id, if any — entirely
 * via the service-role client, every lookup cross-checked against the
 * given `workspaceId` (never resolved by connection id alone and
 * trusted). Mirrors `resolveSocialSchedulerContext`'s own validation order
 * (connection -> credential/scope), checking `instagram_manage_insights`
 * instead of `instagram_content_publish` — this boundary never touches
 * publishing at all.
 */
export async function resolveWorkspaceAnalyticsContext(workspaceId: string, connectionId: string): Promise<ResolveWorkspaceAnalyticsContextResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) return { success: false, reason: "service_role_unavailable" };

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, workspace_id, provider_id, state, credential_id, config")
    .eq("id", connectionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (connectionError || !connection || connection.provider_id !== "meta" || connection.state !== "connected" || !connection.credential_id) {
    return { success: false, reason: "connection" };
  }

  const { data: credential, error: credentialError } = await supabase
    .from("integration_credentials")
    .select("kind, access_token_ref, revoked_at, scopes, workspace_id")
    .eq("id", connection.credential_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (credentialError || !credential || credential.kind !== "oauth_token" || !credential.access_token_ref || credential.revoked_at || !credential.scopes.includes(ANALYTICS_SCOPE)) {
    return { success: false, reason: "credential" };
  }

  const accessToken = await resolveVaultSecret(supabase, credential.access_token_ref);
  if (!accessToken) return { success: false, reason: "credential" };

  const instagramAccountId = typeof connection.config.meta_instagram_account_id === "string" ? connection.config.meta_instagram_account_id : null;

  return { success: true, context: { connectionId, instagramAccountId, accessToken } };
}
