import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { GoogleCalendarAccount } from "@/core/integrations/googleCalendarReadonly/types";

/** GCAL-02 — the real, durable counterpart to `accountStore.ts`'s mock implementation. Uses the server-only, session-bound Supabase client — every read/write here runs as the calling user under RLS (`google_calendar_accounts_own_scope`), since this codebase never uses a service-role client. */
type AccountRow = Database["public"]["Tables"]["google_calendar_accounts"]["Row"];

function mapRow(row: AccountRow): GoogleCalendarAccount {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    integration_connection_id: row.integration_connection_id,
    provider_account_id: row.provider_account_id,
    provider_account_email: row.provider_account_email,
    sync_status: row.sync_status as GoogleCalendarAccount["sync_status"],
    last_synced_at: row.last_synced_at,
    last_successful_sync_at: row.last_successful_sync_at,
    sync_error_code: row.sync_error_code,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertAccount(account: GoogleCalendarAccount): Promise<GoogleCalendarAccount> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendar_accounts")
    .insert({
      id: account.id,
      workspace_id: account.workspace_id,
      member_id: account.member_id,
      integration_connection_id: account.integration_connection_id,
      provider_account_id: account.provider_account_id,
      provider_account_email: account.provider_account_email,
      sync_status: account.sync_status,
      last_synced_at: account.last_synced_at,
      last_successful_sync_at: account.last_successful_sync_at,
      sync_error_code: account.sync_error_code,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapRow(data);
}

export async function getAccountById(id: string): Promise<GoogleCalendarAccount | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendar_accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function getAccountByConnectionId(integrationConnectionId: string): Promise<GoogleCalendarAccount | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendar_accounts").select("*").eq("integration_connection_id", integrationConnectionId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function listAccountsForWorkspace(workspaceId: string): Promise<GoogleCalendarAccount[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendar_accounts").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapRow);
}

export async function updateAccount(id: string, patch: Partial<GoogleCalendarAccount>): Promise<GoogleCalendarAccount | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendar_accounts")
    .update({
      ...(patch.provider_account_id !== undefined ? { provider_account_id: patch.provider_account_id } : {}),
      ...(patch.provider_account_email !== undefined ? { provider_account_email: patch.provider_account_email } : {}),
      ...(patch.sync_status !== undefined ? { sync_status: patch.sync_status } : {}),
      ...(patch.last_synced_at !== undefined ? { last_synced_at: patch.last_synced_at } : {}),
      ...(patch.last_successful_sync_at !== undefined ? { last_successful_sync_at: patch.last_successful_sync_at } : {}),
      ...(patch.sync_error_code !== undefined ? { sync_error_code: patch.sync_error_code } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}
