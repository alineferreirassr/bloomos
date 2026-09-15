import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseInstagramConversationRepository } from "@/lib/data/instagramConversation/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { CreateInstagramConversationInput, CreateInstagramMessageInput } from "@/lib/data/instagramConversation/repository";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  let i = 0;
  function nextResult(): QueryResult {
    if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    return responses[i++];
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    b.select = chain("select");
    b.insert = chain("insert");
    b.update = chain("update");
    b.eq = chain("eq");
    b.order = chain("order");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return nextResult();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(nextResult());
    };
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  return { client, calls };
}

function conversationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "conv_1",
    workspace_id: "ws_1",
    instagram_account_identity_id: "identity_1",
    external_conversation_id: "thread_1",
    external_participant_id: "participant_1",
    external_participant_username: "a_follower",
    status: "active",
    last_message_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function messageRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "message_1",
    conversation_id: "conv_1",
    workspace_id: "ws_1",
    external_message_id: "m1",
    direction: "inbound",
    message_type: "text",
    content: "Hi!",
    external_media_reference: null,
    external_created_at: "2026-01-01T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function stubConversationInput(overrides: Partial<CreateInstagramConversationInput> = {}): CreateInstagramConversationInput {
  return { workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalConversationId: "thread_1", externalParticipantId: "participant_1", externalParticipantUsername: "a_follower", ...overrides };
}

function stubMessageInput(overrides: Partial<CreateInstagramMessageInput> = {}): CreateInstagramMessageInput {
  return { conversationId: "conv_1", workspaceId: "ws_1", externalMessageId: "m1", direction: "inbound", messageType: "text", content: "Hi!", externalMediaReference: null, externalCreatedAt: "2026-01-01T00:00:00.000Z", ...overrides };
}

describe("supabaseInstagramConversationRepository — conversations", () => {
  it("createConversation inserts the expected payload and maps the returned row", async () => {
    const { client, calls } = createMockSupabase([{ data: conversationRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramConversationRepository.createConversation(stubConversationInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("active");

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ workspace_id: "ws_1", instagram_account_identity_id: "identity_1", external_participant_id: "participant_1" });
  });

  it("createConversation maps a unique-violation (23505) to a controlled duplicate error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23505" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramConversationRepository.createConversation(stubConversationInput());
    expect(result.success).toBe(false);
  });

  it("getConversationByExternalParticipantId filters by identity and participant id", async () => {
    const { client, calls } = createMockSupabase([{ data: conversationRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramConversationRepository.getConversationByExternalParticipantId("identity_1", "participant_1");
    expect(result).toMatchObject({ external_participant_id: "participant_1" });
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["instagram_account_identity_id", "identity_1"]);
    expect(eqCalls).toContainEqual(["external_participant_id", "participant_1"]);
  });

  it("getConversationByExternalConversationId filters by identity and Meta's own thread id", async () => {
    const { client, calls } = createMockSupabase([{ data: conversationRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseInstagramConversationRepository.getConversationByExternalConversationId("identity_1", "thread_1");
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["external_conversation_id", "thread_1"]);
  });

  it("listConversationsForWorkspace filters by workspace_id", async () => {
    const { client, calls } = createMockSupabase([{ data: [conversationRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const results = await supabaseInstagramConversationRepository.listConversationsForWorkspace("ws_1");
    expect(results).toHaveLength(1);
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["workspace_id", "ws_1"]);
  });

  it("updateConversationLastMessageAt updates only that field", async () => {
    const { client, calls } = createMockSupabase([{ data: conversationRow({ last_message_at: "2026-02-01T00:00:00.000Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramConversationRepository.updateConversationLastMessageAt("conv_1", "2026-02-01T00:00:00.000Z");
    expect(result.success && result.data.last_message_at).toBe("2026-02-01T00:00:00.000Z");
    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toEqual({ last_message_at: "2026-02-01T00:00:00.000Z" });
  });
});

describe("supabaseInstagramConversationRepository — messages", () => {
  it("createMessage inserts the expected payload including direction and maps the returned row", async () => {
    const { client, calls } = createMockSupabase([{ data: messageRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramConversationRepository.createMessage(stubMessageInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.direction).toBe("inbound");

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ conversation_id: "conv_1", workspace_id: "ws_1", external_message_id: "m1", direction: "inbound" });
  });

  it("createMessage maps a unique-violation (23505) to a controlled duplicate error", async () => {
    const { client } = createMockSupabase([{ data: null, error: { code: "23505" } }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramConversationRepository.createMessage(stubMessageInput());
    expect(result.success).toBe(false);
  });

  it("listMessagesForConversation orders by created_at ascending, then id — ordering/timestamps", async () => {
    const { client, calls } = createMockSupabase([{ data: [messageRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseInstagramConversationRepository.listMessagesForConversation("conv_1");
    const orderCalls = calls.filter((c) => c.method === "order").map((c) => c.args);
    expect(orderCalls[0]).toEqual(["created_at", { ascending: true }]);
    expect(orderCalls[1]).toEqual(["id", { ascending: true }]);
  });

  it("getMessageByExternalId filters by conversation and external_message_id", async () => {
    const { client, calls } = createMockSupabase([{ data: messageRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramConversationRepository.getMessageByExternalId("conv_1", "m1");
    expect(result).toMatchObject({ external_message_id: "m1" });
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["conversation_id", "conv_1"]);
    expect(eqCalls).toContainEqual(["external_message_id", "m1"]);
  });

  it("getMessageByExternalId returns null when no row matches", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);
    expect(await supabaseInstagramConversationRepository.getMessageByExternalId("conv_1", "missing")).toBeNull();
  });
});
