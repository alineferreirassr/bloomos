import type { InstagramConversation } from "@/types/instagramConversation";
import type { InstagramMessage } from "@/types/instagramMessage";
import type { DataResult } from "@/lib/data/result";

export interface CreateInstagramConversationInput {
  workspaceId: string;
  instagramAccountIdentityId: string;
  externalConversationId: string | null;
  externalParticipantId: string;
  externalParticipantUsername: string | null;
}

export interface CreateInstagramMessageInput {
  conversationId: string;
  workspaceId: string;
  externalMessageId: string;
  direction: "inbound" | "outbound";
  messageType: string;
  content: string | null;
  externalMediaReference: string | null;
  externalCreatedAt: string | null;
}

/**
 * SOCIAL-11D — the Instagram Conversation + Message data-access layer,
 * combined in one repository the same way `CarouselRepository`
 * (SOCIAL-10C) covers `carousel_items`/`carousel_slides` — a genuine
 * parent+ordered-children relationship, not two unrelated concerns. No
 * automation/action/reply method exists or should be added here.
 */
export interface InstagramConversationRepository {
  createConversation(input: CreateInstagramConversationInput): Promise<DataResult<InstagramConversation>>;
  /** Primary dedup lookup — Instagram has at most one open thread per (identity, external participant) pair. */
  getConversationByExternalParticipantId(instagramAccountIdentityId: string, externalParticipantId: string): Promise<InstagramConversation | null>;
  /** Secondary dedup lookup, only meaningful when Meta's own thread id is known. */
  getConversationByExternalConversationId(instagramAccountIdentityId: string, externalConversationId: string): Promise<InstagramConversation | null>;
  listConversationsForWorkspace(workspaceId: string): Promise<InstagramConversation[]>;
  /** The one field this checkpoint's own schema exposes as mutable after creation — kept current as messages arrive. */
  updateConversationLastMessageAt(id: string, lastMessageAt: string): Promise<DataResult<InstagramConversation>>;

  createMessage(input: CreateInstagramMessageInput): Promise<DataResult<InstagramMessage>>;
  /** Entity-level dedup lookup, scoped to the owning conversation. */
  getMessageByExternalId(conversationId: string, externalMessageId: string): Promise<InstagramMessage | null>;
  listMessagesForConversation(conversationId: string): Promise<InstagramMessage[]>;
}
