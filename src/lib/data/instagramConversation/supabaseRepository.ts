import type { InstagramConversation } from "@/types/instagramConversation";
import type { InstagramMessage } from "@/types/instagramMessage";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapInstagramConversationRow, mapInstagramMessageRow } from "@/lib/supabase/mappers";
import type { CreateInstagramConversationInput, CreateInstagramMessageInput, InstagramConversationRepository } from "@/lib/data/instagramConversation/repository";

const CONVERSATION_NOT_FOUND_ERROR = "This Instagram conversation could not be found.";
const DUPLICATE_ERROR = "This Instagram conversation has already been recorded.";
const MESSAGE_DUPLICATE_ERROR = "This Instagram message has already been recorded.";

async function createConversation(input: CreateInstagramConversationInput): Promise<DataResult<InstagramConversation>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("instagram_conversations")
    .insert({
      workspace_id: input.workspaceId,
      instagram_account_identity_id: input.instagramAccountIdentityId,
      external_conversation_id: input.externalConversationId,
      external_participant_id: input.externalParticipantId,
      external_participant_username: input.externalParticipantUsername,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") return fail(DUPLICATE_ERROR);
    throw normalizeSupabaseError(error);
  }
  return ok(mapInstagramConversationRow(data));
}

async function getConversationByExternalParticipantId(instagramAccountIdentityId: string, externalParticipantId: string): Promise<InstagramConversation | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("instagram_conversations")
    .select("*")
    .eq("instagram_account_identity_id", instagramAccountIdentityId)
    .eq("external_participant_id", externalParticipantId)
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInstagramConversationRow(data) : null;
}

async function getConversationByExternalConversationId(instagramAccountIdentityId: string, externalConversationId: string): Promise<InstagramConversation | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("instagram_conversations")
    .select("*")
    .eq("instagram_account_identity_id", instagramAccountIdentityId)
    .eq("external_conversation_id", externalConversationId)
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInstagramConversationRow(data) : null;
}

async function listConversationsForWorkspace(workspaceId: string): Promise<InstagramConversation[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_conversations").select("*").eq("workspace_id", workspaceId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInstagramConversationRow);
}

async function updateConversationLastMessageAt(id: string, lastMessageAt: string): Promise<DataResult<InstagramConversation>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_conversations").update({ last_message_at: lastMessageAt }).eq("id", id).select("*").single();
  if (error) {
    if ((error as { code?: string }).code === "PGRST116") return fail(CONVERSATION_NOT_FOUND_ERROR);
    throw normalizeSupabaseError(error);
  }
  return ok(mapInstagramConversationRow(data));
}

async function createMessage(input: CreateInstagramMessageInput): Promise<DataResult<InstagramMessage>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("instagram_messages")
    .insert({
      conversation_id: input.conversationId,
      workspace_id: input.workspaceId,
      external_message_id: input.externalMessageId,
      direction: input.direction,
      message_type: input.messageType,
      content: input.content,
      external_media_reference: input.externalMediaReference,
      external_created_at: input.externalCreatedAt,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === "23505") return fail(MESSAGE_DUPLICATE_ERROR);
    throw normalizeSupabaseError(error);
  }
  return ok(mapInstagramMessageRow(data));
}

async function getMessageByExternalId(conversationId: string, externalMessageId: string): Promise<InstagramMessage | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_messages").select("*").eq("conversation_id", conversationId).eq("external_message_id", externalMessageId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInstagramMessageRow(data) : null;
}

async function listMessagesForConversation(conversationId: string): Promise<InstagramMessage[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("instagram_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapInstagramMessageRow);
}

export const supabaseInstagramConversationRepository: InstagramConversationRepository = {
  createConversation,
  getConversationByExternalParticipantId,
  getConversationByExternalConversationId,
  listConversationsForWorkspace,
  updateConversationLastMessageAt,
  createMessage,
  getMessageByExternalId,
  listMessagesForConversation,
};
