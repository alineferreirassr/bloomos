import { afterEach, describe, expect, it } from "vitest";
import { mockInstagramConversationRepository, resetInstagramConversationsStore } from "@/lib/data/instagramConversation/mockRepository";
import type { CreateInstagramConversationInput, CreateInstagramMessageInput } from "@/lib/data/instagramConversation/repository";

function stubConversationInput(overrides: Partial<CreateInstagramConversationInput> = {}): CreateInstagramConversationInput {
  return {
    workspaceId: "ws_1",
    instagramAccountIdentityId: "identity_1",
    externalConversationId: "thread_1",
    externalParticipantId: "participant_1",
    externalParticipantUsername: "a_follower",
    ...overrides,
  };
}

function stubMessageInput(overrides: Partial<CreateInstagramMessageInput> = {}): CreateInstagramMessageInput {
  return {
    conversationId: "conv_1",
    workspaceId: "ws_1",
    externalMessageId: "message_1",
    direction: "inbound",
    messageType: "text",
    content: "Hi, do you have availability in June?",
    externalMediaReference: null,
    externalCreatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => resetInstagramConversationsStore());

describe("mockInstagramConversationRepository — conversations", () => {
  it("creates a conversation, assigning a stable generated id and defaulting status to active", async () => {
    const result = await mockInstagramConversationRepository.createConversation(stubConversationInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.id).toMatch(/^instagram_conversation_/);
    expect(result.data.status).toBe("active");
    expect(result.data.last_message_at).toBeNull();
  });

  it("allows a conversation with no external_conversation_id when Meta's own thread id isn't available", async () => {
    const result = await mockInstagramConversationRepository.createConversation(stubConversationInput({ externalConversationId: null }));
    expect(result.success && result.data.external_conversation_id).toBeNull();
  });

  it("rejects a duplicate — same identity and same external participant — Instagram has at most one open thread per participant pair", async () => {
    await mockInstagramConversationRepository.createConversation(stubConversationInput());
    const result = await mockInstagramConversationRepository.createConversation(stubConversationInput({ externalConversationId: "thread_2" }));
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate external_conversation_id under the same identity, even with a different participant id", async () => {
    await mockInstagramConversationRepository.createConversation(stubConversationInput({ externalParticipantId: "participant_1", externalConversationId: "thread_1" }));
    const result = await mockInstagramConversationRepository.createConversation(stubConversationInput({ externalParticipantId: "participant_2", externalConversationId: "thread_1" }));
    expect(result.success).toBe(false);
  });

  it("allows the same external participant under a different Instagram identity", async () => {
    await mockInstagramConversationRepository.createConversation(stubConversationInput({ instagramAccountIdentityId: "identity_1", externalParticipantId: "participant_1" }));
    const result = await mockInstagramConversationRepository.createConversation(stubConversationInput({ instagramAccountIdentityId: "identity_2", externalParticipantId: "participant_1" }));
    expect(result.success).toBe(true);
  });

  it("workspace isolation — listConversationsForWorkspace scopes strictly by workspaceId", async () => {
    await mockInstagramConversationRepository.createConversation(stubConversationInput({ workspaceId: "ws_1", externalParticipantId: "p1" }));
    await mockInstagramConversationRepository.createConversation(stubConversationInput({ workspaceId: "ws_2", externalParticipantId: "p2" }));

    const wsOne = await mockInstagramConversationRepository.listConversationsForWorkspace("ws_1");
    expect(wsOne).toHaveLength(1);
    expect(wsOne[0].external_participant_id).toBe("p1");
  });

  it("external ID lookup — getConversationByExternalParticipantId scoped to the right identity, or returns null", async () => {
    await mockInstagramConversationRepository.createConversation(stubConversationInput({ instagramAccountIdentityId: "identity_1", externalParticipantId: "p1" }));
    expect(await mockInstagramConversationRepository.getConversationByExternalParticipantId("identity_1", "p1")).toMatchObject({ external_participant_id: "p1" });
    expect(await mockInstagramConversationRepository.getConversationByExternalParticipantId("identity_1", "missing")).toBeNull();
  });

  it("wrong Instagram identity rejection — a lookup under a different identity returns null", async () => {
    await mockInstagramConversationRepository.createConversation(stubConversationInput({ instagramAccountIdentityId: "identity_1", externalParticipantId: "p1" }));
    expect(await mockInstagramConversationRepository.getConversationByExternalParticipantId("identity_2", "p1")).toBeNull();
  });

  it("getConversationByExternalConversationId finds by Meta's own thread id", async () => {
    await mockInstagramConversationRepository.createConversation(stubConversationInput({ instagramAccountIdentityId: "identity_1", externalConversationId: "thread_1" }));
    expect(await mockInstagramConversationRepository.getConversationByExternalConversationId("identity_1", "thread_1")).toMatchObject({ external_conversation_id: "thread_1" });
  });

  it("updateConversationLastMessageAt updates the timestamp used for a future inbox's own sort order", async () => {
    const created = await mockInstagramConversationRepository.createConversation(stubConversationInput());
    if (!created.success) throw new Error("setup failed");
    const result = await mockInstagramConversationRepository.updateConversationLastMessageAt(created.data.id, "2026-02-01T00:00:00.000Z");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.last_message_at).toBe("2026-02-01T00:00:00.000Z");
  });

  it("updateConversationLastMessageAt fails for an unknown conversation id", async () => {
    const result = await mockInstagramConversationRepository.updateConversationLastMessageAt("missing", "2026-02-01T00:00:00.000Z");
    expect(result.success).toBe(false);
  });
});

describe("mockInstagramConversationRepository — messages (conversation/message relationship)", () => {
  it("creates a message tied to its conversation via conversation_id", async () => {
    const conversation = await mockInstagramConversationRepository.createConversation(stubConversationInput());
    if (!conversation.success) throw new Error("setup failed");

    const result = await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: conversation.data.id }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.conversation_id).toBe(conversation.data.id);
    expect(result.data.id).toMatch(/^instagram_message_/);
  });

  it("rejects a duplicate external message id within the same conversation", async () => {
    await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: "conv_1", externalMessageId: "m1" }));
    const result = await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: "conv_1", externalMessageId: "m1" }));
    expect(result.success).toBe(false);
  });

  it("allows the same external message id under a different conversation", async () => {
    await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: "conv_1", externalMessageId: "m1" }));
    const result = await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: "conv_2", externalMessageId: "m1" }));
    expect(result.success).toBe(true);
  });

  it("captures both inbound and outbound direction", async () => {
    const inbound = await mockInstagramConversationRepository.createMessage(stubMessageInput({ externalMessageId: "m_in", direction: "inbound" }));
    const outbound = await mockInstagramConversationRepository.createMessage(stubMessageInput({ externalMessageId: "m_out", direction: "outbound" }));
    expect(inbound.success && inbound.data.direction).toBe("inbound");
    expect(outbound.success && outbound.data.direction).toBe("outbound");
  });

  it("allows a media-only message with no text content", async () => {
    const result = await mockInstagramConversationRepository.createMessage(stubMessageInput({ content: null, externalMediaReference: "https://cdn.example/media/1" }));
    expect(result.success && result.data.content).toBeNull();
    expect(result.success && result.data.external_media_reference).toBe("https://cdn.example/media/1");
  });

  it("listMessagesForConversation scopes strictly to the given conversation and orders oldest first (ordering/timestamps)", async () => {
    await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: "conv_1", externalMessageId: "m1", content: "first" }));
    await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: "conv_1", externalMessageId: "m2", content: "second" }));
    await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: "conv_2", externalMessageId: "m3", content: "other conversation" }));

    const results = await mockInstagramConversationRepository.listMessagesForConversation("conv_1");
    expect(results).toHaveLength(2);
    expect(results.map((m) => m.content)).toEqual(["first", "second"]);
  });

  it("external ID lookup — getMessageByExternalId scoped to the right conversation, or returns null", async () => {
    await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: "conv_1", externalMessageId: "m1" }));
    expect(await mockInstagramConversationRepository.getMessageByExternalId("conv_1", "m1")).toMatchObject({ external_message_id: "m1" });
    expect(await mockInstagramConversationRepository.getMessageByExternalId("conv_1", "missing")).toBeNull();
    expect(await mockInstagramConversationRepository.getMessageByExternalId("conv_2", "m1")).toBeNull();
  });
});

describe("resetInstagramConversationsStore", () => {
  it("clears both conversations and messages", async () => {
    const conversation = await mockInstagramConversationRepository.createConversation(stubConversationInput());
    if (!conversation.success) throw new Error("setup failed");
    await mockInstagramConversationRepository.createMessage(stubMessageInput({ conversationId: conversation.data.id }));

    resetInstagramConversationsStore();

    expect(await mockInstagramConversationRepository.listConversationsForWorkspace("ws_1")).toEqual([]);
    expect(await mockInstagramConversationRepository.listMessagesForConversation(conversation.data.id)).toEqual([]);
  });
});
