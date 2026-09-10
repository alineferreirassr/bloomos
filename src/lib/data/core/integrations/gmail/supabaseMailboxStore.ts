import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { GmailMailbox } from "@/core/integrations/gmail/types";

/** GMAIL-04 — the real, durable counterpart to `mailboxStore.ts`'s mock implementation. Uses the server-only, session-bound Supabase client — every read/write here runs as the calling user under RLS (`gmail_mailboxes_own_scope`), since this codebase never uses a service-role client. */
type MailboxRow = Database["public"]["Tables"]["gmail_mailboxes"]["Row"];

function mapRow(row: MailboxRow): GmailMailbox {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    integration_connection_id: row.integration_connection_id,
    provider_account_id: row.provider_account_id,
    email_address: row.email_address,
    display_name: row.display_name,
    history_id: row.history_id,
    sync_status: row.sync_status as GmailMailbox["sync_status"],
    last_synced_at: row.last_synced_at,
    last_successful_sync_at: row.last_successful_sync_at,
    sync_error_code: row.sync_error_code,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertMailbox(mailbox: GmailMailbox): Promise<GmailMailbox> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("gmail_mailboxes")
    .insert({
      id: mailbox.id,
      workspace_id: mailbox.workspace_id,
      member_id: mailbox.member_id,
      integration_connection_id: mailbox.integration_connection_id,
      provider_account_id: mailbox.provider_account_id,
      email_address: mailbox.email_address,
      display_name: mailbox.display_name,
      history_id: mailbox.history_id,
      sync_status: mailbox.sync_status,
      last_synced_at: mailbox.last_synced_at,
      last_successful_sync_at: mailbox.last_successful_sync_at,
      sync_error_code: mailbox.sync_error_code,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapRow(data);
}

export async function getMailboxById(id: string): Promise<GmailMailbox | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_mailboxes").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function getMailboxByConnectionId(connectionId: string): Promise<GmailMailbox | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_mailboxes").select("*").eq("integration_connection_id", connectionId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function listMailboxesForWorkspace(workspaceId: string): Promise<GmailMailbox[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_mailboxes").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapRow);
}

export async function updateMailbox(id: string, patch: Partial<GmailMailbox>): Promise<GmailMailbox | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("gmail_mailboxes")
    .update({
      ...(patch.provider_account_id !== undefined ? { provider_account_id: patch.provider_account_id } : {}),
      ...(patch.email_address !== undefined ? { email_address: patch.email_address } : {}),
      ...(patch.display_name !== undefined ? { display_name: patch.display_name } : {}),
      ...(patch.history_id !== undefined ? { history_id: patch.history_id } : {}),
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
