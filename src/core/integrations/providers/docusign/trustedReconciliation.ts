import "server-only";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { getLogger } from "@/core/observability/logger";
import type { Database } from "@/types/database.types";

/**
 * CONTRACTS-03B — BloomOS's first, and deliberately only, DocuSign-scoped
 * service-role boundary. Nothing else in this codebase uses a service-role
 * Supabase client (see CONTRACTS-03A's own repository-wide search); this
 * module exists because an inbound DocuSign webhook has no browser session,
 * and the mechanical re-audit for this checkpoint found the gap goes
 * deeper than the Contract mutation itself — `integration_connections`/
 * `integration_credentials` RLS (`..._all_own_scope`, `to authenticated`)
 * and `read_integration_secret()`'s own `auth.uid()`-based ownership check
 * all require a real signed-in Workspace member too. A cookie-less webhook
 * request resolves none of them today, which means the route can't even
 * reach its own HMAC verification step in a real Supabase deployment —
 * this is fixed here, narrowly, for DocuSign only, never for any other
 * provider or caller.
 *
 * Nothing here is exported beyond the two functions the webhook route
 * needs. The raw client is never returned; the service-role key is never
 * logged, returned, or included in any error message.
 */

const SERVICE_ROLE_ENV_VAR = "SUPABASE_SERVICE_ROLE_KEY";

/** Lazy, never module-scoped — mirrors lib/env.ts's own "re-read on every access, never throw at import time" discipline. */
function createServiceRoleClient(): SupabaseClient<Database> | null {
  const env = getPublicEnv();
  const serviceRoleKey = process.env[SERVICE_ROLE_ENV_VAR]?.trim();
  if (!env.supabaseUrl || !serviceRoleKey) return null;
  return createSupabaseJsClient<Database>(env.supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface DocuSignWebhookContext {
  connectionId: string;
  workspaceId: string;
  /** The Connect HMAC secret — always required to reach signature verification. */
  webhookSecret: string;
  /** The OAuth access token + account identity needed to re-poll DocuSign's own API — null if the connection has no usable OAuth credential (e.g. never fully connected), in which case reconciliation is skipped, never guessed at. */
  accessToken: string | null;
  accountId: string | null;
  accountBaseUri: string | null;
}

async function resolveVaultSecret(supabase: SupabaseClient<Database>, secretId: string): Promise<string | null> {
  // vault.decrypted_secrets is not part of the typed `public` schema — Supabase Vault's own
  // security model restricts it to a privileged connection (service_role), which this
  // already is. Reading it directly avoids depending on read_integration_secret()'s
  // `authenticated`-only grant and its own auth.uid() ownership check, neither of which an
  // unauthenticated webhook caller can satisfy. LIVE-UNVERIFIED — see CONTRACTS-03B report.
  const untyped = supabase as unknown as SupabaseClient;
  const { data, error } = await untyped.schema("vault").from("decrypted_secrets").select("decrypted_secret").eq("id", secretId).maybeSingle();
  if (error || !data || typeof (data as { decrypted_secret?: unknown }).decrypted_secret !== "string") return null;
  return (data as { decrypted_secret: string }).decrypted_secret;
}

/**
 * Privileged, read-only bootstrap for the DocuSign webhook route. Resolves
 * the connection, its webhook secret, and (if available) its OAuth access
 * token — everything HMAC verification and a subsequent re-poll need —
 * entirely via the service-role client. Returns `null` for any failure
 * (unknown connection, wrong provider, no webhook secret configured,
 * secret not resolvable, service-role not configured) — never throws,
 * never reveals which, matching this codebase's own "fail closed, return
 * null" credential-resolution precedent.
 */
export async function resolveDocuSignWebhookContext(connectionId: string): Promise<DocuSignWebhookContext | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    getLogger().error("DocuSign webhook: service-role credential is not configured", { envVar: SERVICE_ROLE_ENV_VAR });
    return null;
  }

  const { data: connection, error: connectionError } = await supabase
    .from("integration_connections")
    .select("id, workspace_id, provider_id, credential_id, config")
    .eq("id", connectionId)
    .maybeSingle();
  if (connectionError || !connection || connection.provider_id !== "docusign") return null;

  const webhookSecretCredentialId = connection.config?.webhook_secret_credential_id;
  if (typeof webhookSecretCredentialId !== "string" || !webhookSecretCredentialId) return null;

  const { data: webhookCredential, error: webhookCredentialError } = await supabase
    .from("integration_credentials")
    .select("kind, access_token_ref, revoked_at")
    .eq("id", webhookSecretCredentialId)
    .maybeSingle();
  if (webhookCredentialError || !webhookCredential || webhookCredential.kind !== "provider_secret" || !webhookCredential.access_token_ref || webhookCredential.revoked_at) {
    return null;
  }

  const webhookSecret = await resolveVaultSecret(supabase, webhookCredential.access_token_ref);
  if (!webhookSecret) return null;

  let accessToken: string | null = null;
  const accountId = typeof connection.config?.docusign_account_id === "string" ? connection.config.docusign_account_id : null;
  const accountBaseUri = typeof connection.config?.docusign_account_base_uri === "string" ? connection.config.docusign_account_base_uri : null;

  if (connection.credential_id) {
    const { data: oauthCredential, error: oauthCredentialError } = await supabase
      .from("integration_credentials")
      .select("kind, access_token_ref, revoked_at")
      .eq("id", connection.credential_id)
      .maybeSingle();
    if (!oauthCredentialError && oauthCredential && oauthCredential.kind === "oauth_token" && oauthCredential.access_token_ref && !oauthCredential.revoked_at) {
      accessToken = await resolveVaultSecret(supabase, oauthCredential.access_token_ref);
    }
  }

  return { connectionId, workspaceId: connection.workspace_id, webhookSecret, accessToken, accountId, accountBaseUri };
}

export type MappedReconciliationStatus = "signed" | "declined";

export interface ReconciliationResult {
  /** True only the first time this exact (connection, envelope, mappedStatus) triple is successfully processed — false for a duplicate delivery, an unknown/foreign envelope, or a contract already outside the legal source state. */
  mutated: boolean;
  contractId: string | null;
  workspaceId: string | null;
  clientId: string | null;
}

const NO_RESULT: ReconciliationResult = { mutated: false, contractId: null, workspaceId: null, clientId: null };

/**
 * The one privileged mutation surface this checkpoint authorizes. Invokes
 * `reconcile_docusign_envelope_status` — a narrow SECURITY DEFINER RPC
 * granted only to `service_role` — which atomically re-derives the
 * Contract from its durable `docusign_envelope_id`, cross-checks
 * `contract.workspace_id === connection.workspace_id`, validates the
 * current `signature_status` is a legal source state, and (at most once
 * per triple, enforced by the ledger's own unique constraint) performs the
 * canonical row + Timeline write. This function never accepts a contract
 * id, a workspace id, or an arbitrary status from its own caller — only a
 * connection id, an envelope id, and one of exactly two normalized
 * outcomes ("signed" | "declined").
 */
export async function reconcileVerifiedDocuSignEnvelope(params: {
  connectionId: string;
  envelopeId: string;
  mappedStatus: MappedReconciliationStatus;
}): Promise<ReconciliationResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) {
    getLogger().error("DocuSign webhook: service-role credential is not configured", { envVar: SERVICE_ROLE_ENV_VAR });
    return NO_RESULT;
  }

  const { data, error } = await supabase.rpc("reconcile_docusign_envelope_status", {
    p_connection_id: params.connectionId,
    p_envelope_id: params.envelopeId,
    p_mapped_status: params.mappedStatus,
  });
  if (error) {
    getLogger().error("DocuSign envelope reconciliation RPC failed", { error: error.message });
    return NO_RESULT;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return NO_RESULT;
  return {
    mutated: Boolean(row.mutated),
    contractId: row.contract_id ?? null,
    workspaceId: row.workspace_id ?? null,
    clientId: row.client_id ?? null,
  };
}
