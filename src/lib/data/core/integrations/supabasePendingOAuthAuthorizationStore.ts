import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { PendingOAuthAuthorizationRow } from "@/lib/data/core/integrations/pendingOAuthAuthorizationStore";

/**
 * GMAIL-03P — the real, durable counterpart to
 * `pendingOAuthAuthorizationStore.ts`'s mock implementation. Holds no
 * plaintext secret — `code_verifier_ref` is an opaque `vault.secrets` id,
 * resolved only via `public.read_pending_oauth_secret()`. Uses the
 * server-only Supabase client (anon key + user session — this codebase
 * never uses a service-role client), same rationale as
 * `supabaseConnectionStore.ts`: the RLS policy on `oauth_pending_authorizations`
 * is the real ownership boundary, not the calling role.
 */
type PendingAuthorizationRow = Database["public"]["Tables"]["oauth_pending_authorizations"]["Row"];

function mapRow(row: PendingAuthorizationRow): PendingOAuthAuthorizationRow {
  return {
    state: row.state,
    provider_id: row.provider_id,
    connection_id: row.connection_id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    redirect_uri: row.redirect_uri,
    code_verifier_ref: row.code_verifier_ref,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

export async function insertPendingAuthorization(row: PendingOAuthAuthorizationRow): Promise<PendingOAuthAuthorizationRow> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("oauth_pending_authorizations")
    .insert({
      state: row.state,
      workspace_id: row.workspace_id,
      member_id: row.member_id,
      provider_id: row.provider_id,
      connection_id: row.connection_id,
      redirect_uri: row.redirect_uri,
      code_verifier_ref: row.code_verifier_ref,
      expires_at: row.expires_at,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapRow(data);
}

export async function getPendingAuthorizationByState(state: string): Promise<PendingOAuthAuthorizationRow | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("oauth_pending_authorizations").select("*").eq("state", state).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function deletePendingAuthorization(state: string): Promise<boolean> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("oauth_pending_authorizations").delete().eq("state", state).select("state");
  if (error) throw normalizeSupabaseError(error);
  return (data?.length ?? 0) > 0;
}

export async function listPendingAuthorizationsForWorkspace(workspaceId: string): Promise<PendingOAuthAuthorizationRow[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("oauth_pending_authorizations").select("*").eq("workspace_id", workspaceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapRow);
}
