import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { GmailEmailAddress, GmailMessage } from "@/core/integrations/gmail/types";

/** GMAIL-04 — the real, durable counterpart to `messageStore.ts`'s mock implementation. `body_text`/`body_html` are protected only by this table's own RLS (`gmail_messages_own_scope`) — see the migration's own header comment. */
type MessageRow = Database["public"]["Tables"]["gmail_messages"]["Row"];

function toAddressList(value: MessageRow["to_addresses"]): GmailEmailAddress[] {
  return (value as unknown as GmailEmailAddress[] | null) ?? [];
}

function mapRow(row: MessageRow): GmailMessage {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    mailbox_id: row.mailbox_id,
    thread_id: row.thread_id,
    provider_message_id: row.provider_message_id,
    provider_thread_id: row.provider_thread_id,
    internal_date: row.internal_date,
    subject: row.subject,
    snippet: row.snippet,
    body_text: row.body_text,
    body_html: row.body_html,
    from_address: (row.from_address as unknown as GmailEmailAddress | null) ?? null,
    to_addresses: toAddressList(row.to_addresses),
    cc_addresses: toAddressList(row.cc_addresses),
    bcc_addresses: toAddressList(row.bcc_addresses),
    reply_to_addresses: toAddressList(row.reply_to_addresses),
    message_id_header: row.message_id_header,
    in_reply_to: row.in_reply_to,
    references_header: row.references_header,
    label_ids: row.label_ids,
    is_read: row.is_read,
    is_starred: row.is_starred,
    is_draft: row.is_draft,
    is_sent: row.is_sent,
    has_attachments: row.has_attachments,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertMessage(message: GmailMessage): Promise<GmailMessage> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("gmail_messages")
    .insert({
      id: message.id,
      workspace_id: message.workspace_id,
      member_id: message.member_id,
      mailbox_id: message.mailbox_id,
      thread_id: message.thread_id,
      provider_message_id: message.provider_message_id,
      provider_thread_id: message.provider_thread_id,
      internal_date: message.internal_date,
      subject: message.subject,
      snippet: message.snippet,
      body_text: message.body_text,
      body_html: message.body_html,
      from_address: message.from_address as unknown as Record<string, unknown> | null,
      to_addresses: message.to_addresses as unknown as Record<string, unknown>[],
      cc_addresses: message.cc_addresses as unknown as Record<string, unknown>[],
      bcc_addresses: message.bcc_addresses as unknown as Record<string, unknown>[],
      reply_to_addresses: message.reply_to_addresses as unknown as Record<string, unknown>[],
      message_id_header: message.message_id_header,
      in_reply_to: message.in_reply_to,
      references_header: message.references_header,
      label_ids: message.label_ids,
      is_read: message.is_read,
      is_starred: message.is_starred,
      is_draft: message.is_draft,
      is_sent: message.is_sent,
      has_attachments: message.has_attachments,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapRow(data);
}

export async function getMessageById(id: string): Promise<GmailMessage | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_messages").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function getMessageByProviderId(mailboxId: string, providerMessageId: string): Promise<GmailMessage | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_messages").select("*").eq("mailbox_id", mailboxId).eq("provider_message_id", providerMessageId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function listMessagesForThread(threadId: string): Promise<GmailMessage[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("gmail_messages").select("*").eq("thread_id", threadId).order("internal_date", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapRow);
}

export async function updateMessage(id: string, patch: Partial<GmailMessage>): Promise<GmailMessage | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("gmail_messages")
    .update({
      ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
      ...(patch.snippet !== undefined ? { snippet: patch.snippet } : {}),
      ...(patch.body_text !== undefined ? { body_text: patch.body_text } : {}),
      ...(patch.body_html !== undefined ? { body_html: patch.body_html } : {}),
      ...(patch.label_ids !== undefined ? { label_ids: patch.label_ids } : {}),
      ...(patch.is_read !== undefined ? { is_read: patch.is_read } : {}),
      ...(patch.is_starred !== undefined ? { is_starred: patch.is_starred } : {}),
      ...(patch.is_draft !== undefined ? { is_draft: patch.is_draft } : {}),
      ...(patch.is_sent !== undefined ? { is_sent: patch.is_sent } : {}),
      ...(patch.has_attachments !== undefined ? { has_attachments: patch.has_attachments } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}
