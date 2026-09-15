import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * SOCIAL-12C — a new, deliberately narrow service-role boundary, scoped
 * only to resolving the Meta access token a Comment Reply Automation
 * Action needs. Mirrors `core/social/socialSchedulerServiceRole.ts` and
 * `core/social/socialAnalyticsServiceRole.ts` exactly (both already
 * explicitly reject sharing this shape as "a generic helper merely to
 * share code" — the established, four-times-repeated precedent in this
 * codebase, `trustedReconciliation.ts` and `core/automation/
 * automationServiceRole.ts` being the other two, is a new narrow module
 * per new concern, never a shared one). `automationServiceRole.ts`'s own
 * doc comment is explicit that it is scoped to the idempotency ledger
 * only ("not a rewrite of that one or a third copy") — reused here would
 * have meant repurposing infrastructure documented as narrowly scoped to
 * something else entirely.
 *
 * The Automation Engine dispatches `instagram.comment_received` from a
 * webhook with no browser session (`SYSTEM_DISPATCH_CONTEXT`,
 * `metaWebhookProcessing.ts`), so — exactly like the scheduler and
 * analytics sync before it — this cannot satisfy `integration_connections`/
 * `integration_credentials`'s own RLS (`to authenticated`,
 * `is_workspace_member()`) through the ordinary session-bound client.
 * Every query here explicitly re-checks `workspace_id` (never resolved by
 * connection id alone and trusted). The service-role key and every
 * resolved access token are never logged, returned, or included in any
 * error message.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";
/**
 * Live-verified against developers.facebook.com (2026-09-14, same pass as
 * SOCIAL-12B): the permission the Instagram comment-reply endpoint
 * (`POST /{ig-comment-id}/replies`) actually requires. NOT currently in
 * this workspace's `defaultScopes` (`modules/integrations/providers/
 * emergingCategoryProviders.ts`) — adding it there is an OAuth-permission
 * change this checkpoint's own HARD RULES explicitly forbid ("Não
 * adicionar novas permissões OAuth"). This check is still added, matching
 * every existing Meta service-role resolver's own established pattern
 * (`instagram_content_publish`/`instagram_manage_insights`) — until a
 * future, explicitly-authorized checkpoint adds the scope to
 * `defaultScopes` and workspaces reconnect, this check will correctly and
 * safely reject every credential (none can have a scope the connect flow
 * never requested), not silently allow a call Meta itself would reject
 * anyway. See the SOCIAL-12C report's own BLOCKED finding.
 */
const REQUIRED_SCOPE = "instagram_manage_comments";

/** Lazy, never module-scoped — mirrors every other narrow service-role boundary's own "re-read on every access, never throw at import time" discipline. */
export function createServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getPublicEnv();
  const serviceRoleKey = process.env[SERVICE_ROLE_ENV_VAR]?.trim();
  if (!env.supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function resolveVaultSecret(supabase: SupabaseClient<Database>, secretId: string): Promise<string | null> {
  // Same technique as every other narrow service-role boundary's own
  // resolveVaultSecret: vault.decrypted_secrets is outside the typed
  // `public` schema and restricted to a privileged (service_role)
  // connection, which this already is.
  const untyped = supabase as unknown as SupabaseClient;
  const { data, error } = await untyped.schema("vault").from("decrypted_secrets").select("decrypted_secret").eq("id", secretId).maybeSingle();
  if (error || !data || typeof (data as { decrypted_secret?: unknown }).decrypted_secret !== "string") return null;
  return (data as { decrypted_secret: string }).decrypted_secret;
}

export interface InstagramCommentReplyContextFailure {
  /** Every kind surfaces the exact same generic message — never a specific reason, matching `socialSchedulerServiceRole.ts`'s own established "never reveal which" discipline for a credential/connection problem. */
  kind: "service_role_unavailable" | "connection" | "credential";
  message: string;
}

export type InstagramCommentReplyContextResult = { success: true; accessToken: string; connectionId: string } | { success: false; failure: InstagramCommentReplyContextFailure };

const RECONNECT_MESSAGE = "Reconnect Meta with comment-reply permission to enable this automation.";

/**
 * Resolves the one thing `replyToInstagramCommentAction` needs — a Meta
 * access token for this workspace's own connected account — entirely via
 * the service-role client, every lookup cross-checked against
 * `workspaceId` (never resolved by connection id alone and trusted).
 * Mirrors `resolveSocialSchedulerContext`'s/`resolveWorkspaceAnalyticsContext`'s
 * own validation order (connection -> credential/scope), checking
 * `instagram_manage_comments` instead. Resolved generically by
 * `workspace_id` + `provider_id=meta` + `state=connected` (there is no
 * per-comment `target_connection_id` the way a `SocialPost` has one) —
 * matching `getOwnProviderConnectionAction`'s own "one connection per
 * workspace" assumption elsewhere in this codebase; `.maybeSingle()`
 * fails safely (a `connection` failure, never a silent arbitrary pick) if
 * that assumption is ever violated.
 */
export async function resolveInstagramCommentReplyContext(workspaceId: string): Promise<InstagramCommentReplyContextResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { success: false, failure: { kind: "service_role_unavailable", message: RECONNECT_MESSAGE } };
  }

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, workspace_id, provider_id, state, credential_id")
    .eq("workspace_id", workspaceId)
    .eq("provider_id", "meta")
    .eq("state", "connected")
    .maybeSingle();
  if (connectionError || !connection || connection.provider_id !== "meta" || connection.state !== "connected" || !connection.credential_id) {
    return { success: false, failure: { kind: "connection", message: RECONNECT_MESSAGE } };
  }

  const { data: credential, error: credentialError } = await supabase
    .from("integration_credentials")
    .select("kind, access_token_ref, revoked_at, scopes, workspace_id")
    .eq("id", connection.credential_id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (credentialError || !credential || credential.kind !== "oauth_token" || !credential.access_token_ref || credential.revoked_at || !credential.scopes.includes(REQUIRED_SCOPE)) {
    return { success: false, failure: { kind: "credential", message: RECONNECT_MESSAGE } };
  }

  const accessToken = await resolveVaultSecret(supabase, credential.access_token_ref);
  if (!accessToken) return { success: false, failure: { kind: "credential", message: RECONNECT_MESSAGE } };

  return { success: true, accessToken, connectionId: connection.id };
}
