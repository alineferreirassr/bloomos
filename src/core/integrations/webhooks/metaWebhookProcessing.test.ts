import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  getInstagramCommentByExternalId: vi.fn(),
  createInstagramComment: vi.fn(),
  getInstagramConversationByExternalParticipantId: vi.fn(),
  createInstagramConversation: vi.fn(),
  getInstagramMessageByExternalId: vi.fn(),
  createInstagramMessage: vi.fn(),
  updateInstagramConversationLastMessageAt: vi.fn(),
}));
vi.mock("@/core/automation/resolver", () => ({
  dispatchAutomationTrigger: vi.fn().mockResolvedValue([]),
}));

import { processMetaWebhookEvent, type MetaWebhookEntryLike } from "@/core/integrations/webhooks/metaWebhookProcessing";
import {
  getInstagramCommentByExternalId,
  createInstagramComment,
  getInstagramConversationByExternalParticipantId,
  createInstagramConversation,
  getInstagramMessageByExternalId,
  createInstagramMessage,
  updateInstagramConversationLastMessageAt,
} from "@/lib/data";
import { dispatchAutomationTrigger } from "@/core/automation/resolver";

const BASE_INPUT = { workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram" };

function commentEntry(overrides: Partial<Record<string, unknown>> = {}): MetaWebhookEntryLike {
  return {
    id: "business_account",
    changes: [{ field: "comments", value: { id: "comment_1", text: "Beautiful!", from: { id: "author_1", username: "a_follower" }, media: { id: "media_1" }, ...overrides } }],
  };
}

function commentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "internal_comment_1", workspace_id: "ws_1", instagram_account_identity_id: "identity_1", external_comment_id: "comment_1", external_author_id: "author_1", parent_external_comment_id: null, ...overrides };
}

function messagingEntry(overrides: Partial<Record<string, unknown>> = {}): MetaWebhookEntryLike {
  return {
    id: "business_account",
    messaging: [{ sender: { id: "participant_1" }, recipient: { id: "business_account" }, timestamp: 1750000000000, message: { mid: "msg_1", text: "Hi, do you have June availability?" }, ...overrides }],
  };
}

function conversationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "internal_conv_1", workspace_id: "ws_1", instagram_account_identity_id: "identity_1", external_participant_id: "participant_1", ...overrides };
}

function messageRow(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "internal_msg_1", conversation_id: "internal_conv_1", workspace_id: "ws_1", direction: "inbound", ...overrides };
}

afterEach(() => vi.clearAllMocks());

describe("processMetaWebhookEvent — comment trigger dispatch", () => {
  it("persists a new comment and dispatches instagram.comment_received with the internal id in facts", async () => {
    vi.mocked(getInstagramCommentByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramComment).mockResolvedValue({ success: true, data: commentRow() as never });

    await processMetaWebhookEvent({ ...BASE_INPUT, entry: commentEntry() });

    expect(createInstagramComment).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalCommentId: "comment_1", externalAuthorId: "author_1" }));
    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ type: "instagram.comment_received", workspaceId: "ws_1", facts: expect.objectContaining({ commentId: "internal_comment_1", hasParent: false }) }),
      expect.objectContaining({ userId: null, permissions: [] }),
    );
  });

  it("captures hasParent=true for a reply comment", async () => {
    vi.mocked(getInstagramCommentByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramComment).mockResolvedValue({ success: true, data: commentRow({ parent_external_comment_id: "parent_1" }) as never });

    await processMetaWebhookEvent({ ...BASE_INPUT, entry: commentEntry({ parent_id: "parent_1" }) });

    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(expect.objectContaining({ facts: expect.objectContaining({ hasParent: true }) }), expect.anything());
  });

  it("duplicate comment (already exists via lookup) — benign, no create, no trigger dispatch", async () => {
    vi.mocked(getInstagramCommentByExternalId).mockResolvedValue(commentRow() as never);

    await processMetaWebhookEvent({ ...BASE_INPUT, entry: commentEntry() });

    expect(createInstagramComment).not.toHaveBeenCalled();
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });

  it("concurrent duplicate — lookup finds nothing but create hits the domain-level unique constraint — benign, no trigger dispatch, no throw", async () => {
    vi.mocked(getInstagramCommentByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramComment).mockResolvedValue({ success: false, error: "This Instagram comment has already been recorded." });

    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: commentEntry() })).resolves.toBeUndefined();
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });

  it("a genuine (non-duplicate) create failure propagates — the caller's own existing catch marks the delivery failed/retryable", async () => {
    vi.mocked(getInstagramCommentByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramComment).mockResolvedValue({ success: false, error: "Database connection lost." });

    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: commentEntry() })).rejects.toThrow("Database connection lost.");
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });

  it("a comment event missing the external comment id is skipped, not an error", async () => {
    await expect(
      processMetaWebhookEvent({ ...BASE_INPUT, entry: { id: "business_account", changes: [{ field: "comments", value: { text: "no id", from: { id: "author_1" } } }] } }),
    ).resolves.toBeUndefined();
    expect(createInstagramComment).not.toHaveBeenCalled();
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });
});

describe("processMetaWebhookEvent — DM/message trigger dispatch", () => {
  it("creates a new conversation and message, updates last_message_at, and dispatches instagram.message_received for an inbound message", async () => {
    vi.mocked(getInstagramConversationByExternalParticipantId).mockResolvedValue(null);
    vi.mocked(createInstagramConversation).mockResolvedValue({ success: true, data: conversationRow() as never });
    vi.mocked(getInstagramMessageByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramMessage).mockResolvedValue({ success: true, data: messageRow({ direction: "inbound" }) as never });

    await processMetaWebhookEvent({ ...BASE_INPUT, entry: messagingEntry() });

    expect(createInstagramConversation).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalParticipantId: "participant_1" }));
    expect(createInstagramMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "internal_conv_1", direction: "inbound", externalMessageId: "msg_1" }));
    expect(updateInstagramConversationLastMessageAt).toHaveBeenCalledWith("internal_conv_1", expect.any(String));
    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ type: "instagram.message_received", workspaceId: "ws_1", facts: expect.objectContaining({ messageId: "internal_msg_1", conversationId: "internal_conv_1" }) }),
      expect.anything(),
    );
  });

  it("reuses an existing conversation rather than creating a second one", async () => {
    vi.mocked(getInstagramConversationByExternalParticipantId).mockResolvedValue(conversationRow() as never);
    vi.mocked(getInstagramMessageByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramMessage).mockResolvedValue({ success: true, data: messageRow() as never });

    await processMetaWebhookEvent({ ...BASE_INPUT, entry: messagingEntry() });

    expect(createInstagramConversation).not.toHaveBeenCalled();
  });

  it("an outbound message (sent from the business account itself, outside BloomOS) is persisted but never dispatches a trigger", async () => {
    vi.mocked(getInstagramConversationByExternalParticipantId).mockResolvedValue(conversationRow() as never);
    vi.mocked(getInstagramMessageByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramMessage).mockResolvedValue({ success: true, data: messageRow({ direction: "outbound" }) as never });

    await processMetaWebhookEvent({ ...BASE_INPUT, entry: messagingEntry({ sender: { id: "business_account" }, recipient: { id: "participant_1" } }) });

    expect(createInstagramMessage).toHaveBeenCalledWith(expect.objectContaining({ direction: "outbound" }));
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });

  it("duplicate message (already exists) — benign, no create, no trigger dispatch", async () => {
    vi.mocked(getInstagramConversationByExternalParticipantId).mockResolvedValue(conversationRow() as never);
    vi.mocked(getInstagramMessageByExternalId).mockResolvedValue(messageRow() as never);

    await processMetaWebhookEvent({ ...BASE_INPUT, entry: messagingEntry() });

    expect(createInstagramMessage).not.toHaveBeenCalled();
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });

  it("concurrent duplicate conversation create — re-reads the winning row rather than throwing", async () => {
    vi.mocked(getInstagramConversationByExternalParticipantId).mockResolvedValueOnce(null).mockResolvedValueOnce(conversationRow() as never);
    vi.mocked(createInstagramConversation).mockResolvedValue({ success: false, error: "This Instagram conversation has already been recorded." });
    vi.mocked(getInstagramMessageByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramMessage).mockResolvedValue({ success: true, data: messageRow() as never });

    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: messagingEntry() })).resolves.toBeUndefined();
    expect(createInstagramMessage).toHaveBeenCalledWith(expect.objectContaining({ conversationId: "internal_conv_1" }));
  });

  it("a genuine (non-duplicate) message create failure propagates — retryable", async () => {
    vi.mocked(getInstagramConversationByExternalParticipantId).mockResolvedValue(conversationRow() as never);
    vi.mocked(getInstagramMessageByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramMessage).mockResolvedValue({ success: false, error: "Database connection lost." });

    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: messagingEntry() })).rejects.toThrow("Database connection lost.");
  });

  it("a messaging event naming neither party as the resolved business account is skipped, not an error", async () => {
    await expect(
      processMetaWebhookEvent({ ...BASE_INPUT, entry: messagingEntry({ sender: { id: "someone_else" }, recipient: { id: "someone_else_too" } }) }),
    ).resolves.toBeUndefined();
    expect(createInstagramConversation).not.toHaveBeenCalled();
  });

  it("a messaging event missing the message id is skipped, not an error", async () => {
    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: messagingEntry({ message: {} }) })).resolves.toBeUndefined();
    expect(createInstagramConversation).not.toHaveBeenCalled();
  });
});

describe("processMetaWebhookEvent — unknown/no-op events", () => {
  it("an unknown event shape (no changes, no messaging) is a no-op, never an error", async () => {
    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: { id: "business_account" } })).resolves.toBeUndefined();
    expect(createInstagramComment).not.toHaveBeenCalled();
    expect(createInstagramConversation).not.toHaveBeenCalled();
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });

  it("an undefined entry is a no-op, never an error", async () => {
    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: undefined })).resolves.toBeUndefined();
    expect(dispatchAutomationTrigger).not.toHaveBeenCalled();
  });

  it("a change field other than 'comments' is not processed", async () => {
    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: { id: "business_account", changes: [{ field: "story_insights", value: {} }] } })).resolves.toBeUndefined();
    expect(createInstagramComment).not.toHaveBeenCalled();
  });
});

describe("processMetaWebhookEvent — workspace isolation and cross-workspace safety", () => {
  it("always passes the caller-supplied, server-resolved workspaceId through to the dispatched trigger — never a value derived from the payload itself", async () => {
    vi.mocked(getInstagramCommentByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramComment).mockResolvedValue({ success: true, data: commentRow({ workspace_id: "ws_correct" }) as never });

    await processMetaWebhookEvent({ ...BASE_INPUT, workspaceId: "ws_correct", entry: commentEntry() });

    expect(createInstagramComment).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws_correct" }));
    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws_correct" }), expect.anything());
  });

  it("a trigger dispatch failure never throws out of processMetaWebhookEvent — logged, not surfaced as a webhook-processing failure", async () => {
    vi.mocked(getInstagramCommentByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramComment).mockResolvedValue({ success: true, data: commentRow() as never });
    vi.mocked(dispatchAutomationTrigger).mockRejectedValueOnce(new Error("engine exploded"));

    await expect(processMetaWebhookEvent({ ...BASE_INPUT, entry: commentEntry() })).resolves.toBeUndefined();
  });
});

describe("processMetaWebhookEvent — dispatch context boundary (no outbound/AI/Lead/CRM action)", () => {
  it("dispatches with permissions: [] and userId: null — the exact system-originated shape, never an elevated/human context", async () => {
    vi.mocked(getInstagramCommentByExternalId).mockResolvedValue(null);
    vi.mocked(createInstagramComment).mockResolvedValue({ success: true, data: commentRow() as never });

    await processMetaWebhookEvent({ ...BASE_INPUT, entry: commentEntry() });

    expect(dispatchAutomationTrigger).toHaveBeenCalledWith(expect.anything(), { workspaceName: null, userId: null, userName: null, role: null, permissions: [] });
  });
});
