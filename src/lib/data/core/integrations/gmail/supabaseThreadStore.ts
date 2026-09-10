import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { GmailThread } from "@/core/integrations/gmail/types";

/** GMAIL-04 — the real, durable counterpart to `threadStore.ts`'s mock implementation. */
type ThreadRow = Database["public"]["Tables"]["gmail_threads"]["Row"];

function mapRow(row: ThreadRow): GmailThread {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    mailbox_id: row.mailbox_id,
    provider_thread_id: row.provider_thread_id,
    subject: row.subject,
    snippet: row.snippet,
    latest_message_at: row.latest_message_at,
    message_count: row.message_count,
    unread_count: row.unread_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertThread(thread: GmailThread): Promise<GmailThread> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("gmail_threads")
    .insert({
      id: thread.id,
      workspace_id: thread.workspace_id,
      member_id: thread.member_id,
      mailbox_id: thread.mailbox_id,
      provider_thread_id: thread.provider_thread_id,
      subject: thread.subject,
      snippet: thread.snippet,
      latest_message_at: thread.latest_message_at,
      message_count: thread.message_count,
      unread_count: thread.unread_count,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapRow(data);
}

export async function getThreadById(id: string): Promise<GmailThread | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_threads").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function getThreadByProviderId(mailboxId: string, providerThreadId: string): Promise<GmailThread | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_threads").select("*").eq("mailbox_id", mailboxId).eq("provider_thread_id", providerThreadId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function listThreadsForMailbox(mailboxId: string): Promise<GmailThread[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_threads").select("*").eq("mailbox_id", mailboxId).order("latest_message_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapRow);
}

export async function updateThread(id: string, patch: Partial<GmailThread>): Promise<GmailThread | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("gmail_threads")
    .update({
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      ...(patch.snippet !== undefined ? { snippet: patch.snippet } : {}),
      ...(patch.latest_message_at !== undefined ? { latest_message_at: patch.latest_message_at } : {}),
      ...(patch.message_count !== undefined ? { message_count: patch.message_count } : {}),
      ...(patch.unread_count !== undefined ? { unread_count: patch.unread_count } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}
