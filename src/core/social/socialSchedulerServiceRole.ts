import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getLogger } from "@/core/observability/logger";
import { RECONNECT_ERROR } from "@/core/social/socialSchedulingPolicy";
import type { SocialPost } from "@/types/socialPost";
import type { Database } from "@/types/database.types";

/**
 * SOCIAL-04B — BloomOS's second, and deliberately still-narrow,
 * service-role boundary (the first is `trustedReconciliation.ts`'s
 * DocuSign-only one; SOCIAL-04A's own audit explicitly rejected refactoring
 * that file into a generic helper "merely to share code" — this is a new,
 * Social-scheduling-only module, same shape, not a shared library).
 *
 * The Social scheduler (`scheduledPostExecutor.ts`, invoked from a
 * CRON_SECRET-protected route with no browser session) has no `auth.uid()`,
 * so it cannot satisfy `integration_connections`/`integration_credentials`/
 * `media_assets`' own RLS policies (all `to authenticated`, all keyed off
 * `is_workspace_member()`/ownership checks that read `auth.uid()`) through
 * the ordinary session-bound client. This module is the one place that
 * bypasses RLS via the service-role key to read what the scheduler needs —
 * every query here explicitly re-checks `workspace_id` against the
 * already-claimed post's own `workspace_id` (SOCIAL-04A Phase 14 — RLS
 * cannot enforce this for a service-role caller, so application code must).
 * Nothing here is exported beyond what the executor needs. The service-role
 * key is never logged, returned, or included in any error message.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";

/**
 * Lazy, never module-scoped — mirrors `trustedReconciliation.ts`'s/`lib/env.ts`'s
 * own "re-read on every access, never throw at import time" discipline.
 * Exported only for `scheduledPostExecutor.ts` (the claim RPC call and the
 * post-execution write-backs both need the same service-role client this
 * module already knows how to construct) — still nowhere near a generic,
 * shared service-role helper: both call sites are this one narrow Social
 * scheduling boundary.
 */
export function createServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getPublicEnv();
  const serviceRoleKey = process.env[SERVICE_ROLE_ENV_VAR]?.trim();
  if (!env.supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveVaultSecret(supabase: SupabaseClient<Database>, secretId: string): Promise<string | null> {
  // Same technique as trustedReconciliation.ts's own resolveVaultSecret:
  // vault.decrypted_secrets is outside the typed `public` schema and
  // restricted to a privileged (service_role) connection, which this
  // already is — reading it directly avoids depending on
  // read_integration_secret()'s `authenticated`-only grant and its own
  // auth.uid() ownership check, neither of which this caller can satisfy.
  const untyped = supabase as unknown as SupabaseClient;
  const { data, error } = await untyped.schema("vault").from("decrypted_secrets").select("decrypted_secret").eq("id", secretId).maybeSingle();
  if (error || !data || typeof (data as { decrypted_secret?: unknown }).decrypted_secret !== "string") return null;
  return (data as { decrypted_secret: string }).decrypted_secret;
}

export interface SocialSchedulerContextFailure {
  /** `"connection" | "credential"` both surface the exact same generic RECONNECT_ERROR message `publishSocialPostNowAction` already uses — never a specific reason, matching that action's own established "never reveal which" discipline. `"asset"` keeps its own specific, already-established message (`validateOwnedApprovedImageAsset`'s exact strings) since that's user-actionable content detail, not a credential-security concern. */
  kind: "service_role_unavailable" | "connection" | "credential" | "asset" | "signed_url";
  message: string;
}

export type SocialSchedulerContextResult = { success: true; accessToken: string; imageUrl: string } | { success: false; failure: SocialSchedulerContextFailure };

const SUPPORTED_IMAGE_MIME_TYPE = "image/jpeg";
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Resolves everything `executeSocialPostPublish` needs for one already-claimed
 * post — the Meta access token and a fresh signed image URL — entirely via
 * the service-role client, with every lookup cross-checked against the
 * post's own `workspace_id` (never resolved by id alone and trusted).
 * Mirrors `publishSocialPostNowAction`'s own validation order exactly
 * (connection -> credential/scope -> asset -> signed URL), just through a
 * service-role client instead of the session-bound one.
 */
export async function resolveSocialSchedulerContext(post: SocialPost): Promise<SocialSchedulerContextResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    getLogger().error("Social scheduler: service-role credential is not configured", { envVar: SERVICE_ROLE_ENV_VAR });
    return { success: false, failure: { kind: "service_role_unavailable", message: RECONNECT_ERROR } };
  }

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, workspace_id, provider_id, state, credential_id")
    .eq("id", post.target_connection_id)
    .eq("workspace_id", post.workspace_id)
    .maybeSingle();
  if (connectionError || !connection || connection.provider_id !== "meta" || connection.state !== "connected" || !connection.credential_id) {
    if (connection && connection.workspace_id !== post.workspace_id) {
      getLogger().error("Social scheduler: cross-workspace connection mismatch refused", { postWorkspaceId: post.workspace_id, connectionId: post.target_connection_id });
    }
    return { success: false, failure: { kind: "connection", message: RECONNECT_ERROR } };
  }

  const { data: credential, error: credentialError } = await supabase
    .from("integration_credentials")
    .select("kind, access_token_ref, revoked_at, scopes, workspace_id")
    .eq("id", connection.credential_id)
    .eq("workspace_id", post.workspace_id)
    .maybeSingle();
  if (credentialError || !credential || credential.kind !== "oauth_token" || !credential.access_token_ref || credential.revoked_at || !credential.scopes.includes("instagram_content_publish")) {
    return { success: false, failure: { kind: "credential", message: RECONNECT_ERROR } };
  }

  const accessToken = await resolveVaultSecret(supabase, credential.access_token_ref);
  if (!accessToken) return { success: false, failure: { kind: "credential", message: RECONNECT_ERROR } };

  const { data: asset, error: assetError } = await supabase
    .from("media_assets")
    .select("id, workspace_id, mime_type, storage_bucket, storage_path")
    .eq("id", post.asset_id)
    .eq("workspace_id", post.workspace_id)
    .maybeSingle();
  if (assetError || !asset) return { success: false, failure: { kind: "asset", message: "That image could not be found." } };
  if (asset.mime_type !== SUPPORTED_IMAGE_MIME_TYPE) return { success: false, failure: { kind: "asset", message: "Instagram requires a JPEG image." } };
  // KNOWN, PRE-EXISTING GAP (not introduced by SOCIAL-04B — see its own
  // checkpoint report): `media_assets` has no real `status` column in any
  // migration; `mapMediaAssetRow` (src/lib/supabase/mappers.ts) hardcodes
  // `status: "pending"` for every Supabase-mode asset, since the DAM
  // status/approval fields were never migrated. Mirrored here explicitly
  // (never selected as a real column, since none exists) rather than
  // silently loosening `validateOwnedApprovedImageAsset`'s own equivalent
  // check — this makes every real Supabase-mode asset fail this check
  // today, identically to the existing interactive path. Fixing the
  // underlying gap is SOCIAL-03-scoped, outside this checkpoint's own
  // authorized scope.
  const supabaseModeAssetStatus: string = "pending";
  if (supabaseModeAssetStatus !== "approved") return { success: false, failure: { kind: "asset", message: "Only an approved image can be published." } };

  const { data: signedUrl, error: signedUrlError } = await supabase.storage.from(asset.storage_bucket).createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signedUrlError || !signedUrl) return { success: false, failure: { kind: "signed_url", message: "Could not prepare the image for publishing." } };

  return { success: true, accessToken, imageUrl: signedUrl.signedUrl };
}
