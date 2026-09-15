import type { InstagramConversation } from "@/types/instagramConversation";
import type { InstagramMessage } from "@/types/instagramMessage";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import type { CreateInstagramConversationInput, CreateInstagramMessageInput, InstagramConversationRepository } from "@/lib/data/instagramConversation/repository";

let conversations: InstagramConversation[] = [];
let messages: InstagramMessage[] = [];

export function resetInstagramConversationsStore(): void {
  conversations = [];
  messages = [];
}

const CONVERSATION_NOT_FOUND_ERROR = "This Instagram conversation could not be found.";
const CONVERSATION_DUPLICATE_ERROR = "This Instagram conversation has already been recorded.";
const MESSAGE_DUPLICATE_ERROR = "This Instagram message has already been recorded.";

async function createConversation(input: CreateInstagramConversationInput): Promise<DataResult<InstagramConversation>> {
  const duplicateByParticipant = conversations.find(
    (c) => c.instagram_account_identity_id === input.instagramAccountIdentityId && c.external_participant_id === input.externalParticipantId,
  );
  if (duplicateByParticipant) return fail(CONVERSATION_DUPLICATE_ERROR);

  if (input.externalConversationId) {
    const duplicateByConversationId = conversations.find(
      (c) => c.instagram_account_identity_id === input.instagramAccountIdentityId && c.external_conversation_id === input.externalConversationId,
    );
    if (duplicateByConversationId) return fail(CONVERSATION_DUPLICATE_ERROR);
  }

  const timestamp = nowIso();
  const conversation: InstagramConversation = {
    id: generateId("instagram_conversation"),
    workspace_id: input.workspaceId,
    instagram_account_identity_id: input.instagramAccountIdentityId,
    external_conversation_id: input.externalConversationId,
    external_participant_id: input.externalParticipantId,
    external_participant_username: input.externalParticipantUsername,
    status: "active",
    last_message_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  conversations = [...conversations, conversation];
  return ok(conversation);
}

async function getConversationByExternalParticipantId(instagramAccountIdentityId: string, externalParticipantId: string): Promise<InstagramConversation | null> {
  return conversations.find((c) => c.instagram_account_identity_id === instagramAccountIdentityId && c.external_participant_id === externalParticipantId) ?? null;
}

async function getConversationByExternalConversationId(instagramAccountIdentityId: string, externalConversationId: string): Promise<InstagramConversation | null> {
  return conversations.find((c) => c.instagram_account_identity_id === instagramAccountIdentityId && c.external_conversation_id === externalConversationId) ?? null;
}

async function listConversationsForWorkspace(workspaceId: string): Promise<InstagramConversation[]> {
  return conversations.filter((c) => c.workspace_id === workspaceId);
}

async function updateConversationLastMessageAt(id: string, lastMessageAt: string): Promise<DataResult<InstagramConversation>> {
  const existing = conversations.find((c) => c.id === id);
  if (!existing) return fail(CONVERSATION_NOT_FOUND_ERROR);

  const updated: InstagramConversation = { ...existing, last_message_at: lastMessageAt, updated_at: nowIso() };
  conversations = conversations.map((c) => (c.id === id ? updated : c));
  return ok(updated);
}

async function createMessage(input: CreateInstagramMessageInput): Promise<DataResult<InstagramMessage>> {
  const duplicate = messages.find((m) => m.conversation_id === input.conversationId && m.external_message_id === input.externalMessageId);
  if (duplicate) return fail(MESSAGE_DUPLICATE_ERROR);

  const timestamp = nowIso();
  const message: InstagramMessage = {
    id: generateId("instagram_message"),
    conversation_id: input.conversationId,
    workspace_id: input.workspaceId,
    external_message_id: input.externalMessageId,
    direction: input.direction,
    message_type: input.messageType,
    content: input.content,
    external_media_reference: input.externalMediaReference,
    external_created_at: input.externalCreatedAt,
    created_at: timestamp,
    updated_at: timestamp,
  };
  messages = [...messages, message];
  return ok(message);
}

async function getMessageByExternalId(conversationId: string, externalMessageId: string): Promise<InstagramMessage | null> {
  return messages.find((m) => m.conversation_id === conversationId && m.external_message_id === externalMessageId) ?? null;
}

/** `messages` already preserves true insertion order (array push order) — a plain filter is the correct, stable ordering. Sorting by `created_at` with an `id` tie-break would be wrong here: two messages created in the same millisecond would tie on `created_at`, and `id` (a random UUID) would then reorder them unpredictably instead of preserving creation order. */
async function listMessagesForConversation(conversationId: string): Promise<InstagramMessage[]> {
  return messages.filter((m) => m.conversation_id === conversationId);
}

export const mockInstagramConversationRepository: InstagramConversationRepository = {
  createConversation,
  getConversationByExternalParticipantId,
  getConversationByExternalConversationId,
  listConversationsForWorkspace,
  updateConversationLastMessageAt,
  createMessage,
  getMessageByExternalId,
  listMessagesForConversation,
};
