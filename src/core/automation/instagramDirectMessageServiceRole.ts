import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

/**
 * SOCIAL-12D — a new, deliberately narrow service-role boundary, scoped
 * only to resolving what a DM Send Automation Action needs: the Meta
 * access token AND the linked Facebook Page id (`sendInstagramDirectMessage`
 * is keyed on `pageId`, unlike the comment-reply endpoint — see
 * `metaProvider.ts`'s own doc comment for that method). Mirrors
 * `instagramCommentReplyServiceRole.ts` (SOCIAL-12C) almost exactly; a new
 * file rather than a generalized/shared one, per this checkpoint's own
 * explicit instruction to prefer the minimal, safe option over broadening
 * an existing narrow module's scope. This is now the sixth instance of the
 * same established, deliberately-not-shared shape in this codebase
 * (`trustedReconciliation.ts`, `socialSchedulerServiceRole.ts`,
 * `socialAnalyticsServiceRole.ts`, `core/automation/automationServiceRole.ts`,
 * `instagramCommentReplyServiceRole.ts`, and now this one).
 *
 * The Automation Engine dispatches `instagram.message_received` from a
 * webhook with no browser session (`SYSTEM_DISPATCH_CONTEXT`,
 * `metaWebhookProcessing.ts`), so — exactly like every prior narrow
 * boundary — this cannot satisfy `integration_connections`/
 * `integration_credentials`'s own RLS through the ordinary session-bound
 * client. Every query here explicitly re-checks `workspace_id` (never
 * resolved by connection id alone and trusted). The service-role key and
 * every resolved access token are never logged, returned, or included in
 * any error message.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";
/**
 * Live-verified against developers.facebook.com (2026-09-14, the same
 * SOCIAL-12B research pass that verified `POST /{page-id}/messages` itself
 * — see that page's own "Requisitos" section: "A permissão
 * instagram_manage_messages"). NOT currently in this workspace's
 * `defaultScopes` (`modules/integrations/providers/
 * emergingCategoryProviders.ts`) — adding it there is an OAuth-permission
 * change this checkpoint's own HARD RULES explicitly forbid ("Não
 * adicionar permissões OAuth", "Não modificar defaultScopes"). This check
 * is still added, matching every existing Meta service-role resolver's own
 * established pattern — until a future, explicitly-authorized checkpoint
 * adds the scope to `defaultScopes` and workspaces reconnect, this check
 * will correctly and safely reject every credential (none can have a scope
 * the connect flow never requested), not silently allow a call Meta itself
 * would reject anyway. See the SOCIAL-12D report's own BLOCKER finding —
 * the same shape as SOCIAL-12C's own `instagram_manage_comments` gap,
 * intentionally not resolved here either.
 */
const REQUIRED_SCOPE = "instagram_manage_messages";

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

export interface InstagramDirectMessageContextFailure {
  /** Every kind surfaces the exact same generic message — never a specific reason, matching `instagramCommentReplyServiceRole.ts`'s own established "never reveal which" discipline for a credential/connection problem. */
  kind: "service_role_unavailable" | "connection" | "credential" | "page";
  message: string;
}

export type InstagramDirectMessageContextResult = { success: true; accessToken: string; connectionId: string; pageId: string } | { success: false; failure: InstagramDirectMessageContextFailure };

const RECONNECT_MESSAGE = "Reconnect Meta with DM-send permission to enable this automation.";
const PAGE_NOT_SELECTED_MESSAGE = "Select a Meta Page/Instagram publishing identity to enable this automation.";

/**
 * Resolves everything `sendInstagramDirectMessageAction` needs — a Meta
 * access token and the linked Facebook Page id — entirely via the
 * service-role client, every lookup cross-checked against `workspaceId`
 * (never resolved by connection id alone and trusted). Mirrors
 * `resolveInstagramCommentReplyContext`'s own validation order (connection
 * -> credential/scope), checking `instagram_manage_messages` instead, plus
 * one extra step reading `pageId` from the connection's own existing
 * `config.meta_page_id` (the exact same generic connection-config field
 * `metaAccountActions.ts`'s `getSelectedMetaPublishingIdentityAction`
 * already reads — no new column, no new storage). Resolved generically by
 * `workspace_id` + `provider_id=meta` + `state=connected` — there is no
 * per-conversation `target_connection_id`; `.maybeSingle()` fails safely
 * (a `connection` failure, never a silent arbitrary pick) if a workspace
 * ever has more than one.
 */
export async function resolveInstagramDirectMessageContext(workspaceId: string): Promise<InstagramDirectMessageContextResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    return { success: false, failure: { kind: "service_role_unavailable", message: RECONNECT_MESSAGE } };
  }

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, workspace_id, provider_id, state, credential_id, config")
    .eq("workspace_id", workspaceId)
    .eq("provider_id", "meta")
    .eq("state", "connected")
    .maybeSingle();
  if (connectionError || !connection || connection.provider_id !== "meta" || connection.state !== "connected" || !connection.credential_id) {
    return { success: false, failure: { kind: "connection", message: RECONNECT_MESSAGE } };
  }

  const pageId = typeof connection.config?.meta_page_id === "string" && connection.config.meta_page_id.length > 0 ? connection.config.meta_page_id : null;
  if (!pageId) {
    return { success: false, failure: { kind: "page", message: PAGE_NOT_SELECTED_MESSAGE } };
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

  return { success: true, accessToken, connectionId: connection.id, pageId };
}
