import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { IntegrationCredential } from "@/core/integrations/types";

/**
 * GMAIL-02 — the real, durable counterpart to `credentialStore.ts`'s mock
 * implementation. Never stores a plaintext secret or token: by the time a
 * caller reaches `insertCredential`, `access_token_ref`/`refresh_token_ref`
 * are already opaque Vault secret ids, produced by
 * `credentialManager.ts` calling `EncryptionProvider.encrypt()` first (see
 * `vaultEncryptionProvider.ts`). This file only ever moves that already-
 * encrypted reference in and out of `public.integration_credentials` —
 * it never calls Vault itself.
 *
 * Uses the server-only, cookie/session-bound Supabase client
 * (`lib/supabase/server.ts`, `import "server-only"`) so this can never be
 * bundled into a Client Component — every read/write here runs as the
 * calling user under RLS, since this codebase never uses a service-role
 * client anywhere.
 */
type CredentialRow = Database["public"]["Tables"]["integration_credentials"]["Row"];

function mapRow(row: CredentialRow): IntegrationCredential {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    connection_id: row.connection_id,
    kind: row.kind as IntegrationCredential["kind"],
    key_hash: row.key_hash,
    key_prefix: row.key_prefix,
    access_token_ref: row.access_token_ref,
    refresh_token_ref: row.refresh_token_ref,
    scopes: row.scopes,
    expires_at: row.expires_at,
    rotated_at: row.rotated_at,
    revoked_at: row.revoked_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertCredential(credential: IntegrationCredential): Promise<IntegrationCredential> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_credentials")
    .insert({
      id: credential.id,
      workspace_id: credential.workspace_id,
      member_id: credential.member_id,
      connection_id: credential.connection_id,
      kind: credential.kind,
      key_hash: credential.key_hash,
      key_prefix: credential.key_prefix,
      access_token_ref: credential.access_token_ref,
      refresh_token_ref: credential.refresh_token_ref,
      scopes: credential.scopes,
      expires_at: credential.expires_at,
      created_by: credential.created_by,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapRow(data);
}

export async function getCredentialById(id: string): Promise<IntegrationCredential | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("integration_credentials").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function getCredentialByConnectionId(connectionId: string): Promise<IntegrationCredential | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_credentials")
    .select("*")
    .eq("connection_id", connectionId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function listCredentialsForWorkspace(workspaceId: string): Promise<IntegrationCredential[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_credentials")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapRow);
}

export async function updateCredential(id: string, patch: Partial<IntegrationCredential>): Promise<IntegrationCredential | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("integration_credentials")
    .update({
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.key_hash !== undefined ? { key_hash: patch.key_hash } : {}),
      ...(patch.key_prefix !== undefined ? { key_prefix: patch.key_prefix } : {}),
      ...(patch.access_token_ref !== undefined ? { access_token_ref: patch.access_token_ref } : {}),
      ...(patch.refresh_token_ref !== undefined ? { refresh_token_ref: patch.refresh_token_ref } : {}),
      ...(patch.scopes !== undefined ? { scopes: patch.scopes } : {}),
      ...(patch.expires_at !== undefined ? { expires_at: patch.expires_at } : {}),
      ...(patch.rotated_at !== undefined ? { rotated_at: patch.rotated_at } : {}),
      ...(patch.revoked_at !== undefined ? { revoked_at: patch.revoked_at } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}
