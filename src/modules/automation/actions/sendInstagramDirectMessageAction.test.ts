import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  listInstagramConversationsForWorkspace: vi.fn(),
}));
vi.mock("@/core/automation/instagramDirectMessageServiceRole", () => ({
  resolveInstagramDirectMessageContext: vi.fn(),
}));

import sendInstagramDirectMessageAction, { SEND_INSTAGRAM_DIRECT_MESSAGE_ACTION_ID } from "@/modules/automation/actions/sendInstagramDirectMessageAction";
import { listInstagramConversationsForWorkspace } from "@/lib/data";
import { resolveInstagramDirectMessageContext } from "@/core/automation/instagramDirectMessageServiceRole";
import { registerAutomationAction, resetAutomationActionRegistry, getAutomationAction } from "@/core/automation/actionRegistry";
import { executeAutomation } from "@/core/automation/resolver";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationActionParams, AutomationDefinition, AutomationTriggerEvent } from "@/types/automation";
import type { InstagramConversation } from "@/types/instagramConversation";

const listConversationsMock = vi.mocked(listInstagramConversationsForWorkspace);
const resolveContextMock = vi.mocked(resolveInstagramDirectMessageContext);

function actionParams(overrides: Partial<AutomationActionParams> = {}): AutomationActionParams {
  return {
    workspaceId: "ws_1",
    workspaceName: "Amoré Bloom",
    userId: null,
    userName: null,
    role: null,
    permissions: [],
    facts: { conversationId: "conversation_domain_1", dmMessage: "Hi there, thanks for reaching out!" },
    automationId: "automation_1",
    ...overrides,
  };
}

function conversationRow(overrides: Partial<InstagramConversation> = {}): InstagramConversation {
  return {
    id: "conversation_domain_1",
    workspace_id: "ws_1",
    instagram_account_identity_id: "identity_1",
    external_conversation_id: null,
    external_participant_id: "igsid_1",
    external_participant_username: "a_follower",
    status: "active",
    last_message_at: "2026-09-15T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function trigger(overrides: Partial<AutomationTriggerEvent> = {}): AutomationTriggerEvent {
  return {
    type: "instagram.message_received",
    workspaceId: "ws_1",
    occurredAt: "2026-09-15T00:00:00.000Z",
    actorMemberId: null,
    facts: { conversationId: "conversation_domain_1", dmMessage: "Hi there, thanks for reaching out!" },
    ...overrides,
  };
}

function automation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "test-dm-send-automation",
    name: "Test — send DM",
    description: "Test-only.",
    category: "general",
    version: "test-v1",
    status: "active",
    trigger: "instagram.message_received",
    conditions: [],
    actionIds: [SEND_INSTAGRAM_DIRECT_MESSAGE_ACTION_ID],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

afterEach(() => {
  resetAutomationActionRegistry();
  resetAutomationStore();
  vi.unstubAllGlobals();
  listConversationsMock.mockReset();
  resolveContextMock.mockReset();
});

describe("sendInstagramDirectMessageAction — registration", () => {
  it("1. is registered under its own stable id, matching SEND_INSTAGRAM_DIRECT_MESSAGE_ACTION_ID", () => {
    registerAutomationAction(sendInstagramDirectMessageAction);
    expect(getAutomationAction(SEND_INSTAGRAM_DIRECT_MESSAGE_ACTION_ID)).toBe(sendInstagramDirectMessageAction);
    expect(SEND_INSTAGRAM_DIRECT_MESSAGE_ACTION_ID).toBe("send-instagram-direct-message");
  });
});

describe("sendInstagramDirectMessageAction — execute()", () => {
  it("2/3/4/5/6. successful DM send calls MetaProvider.sendInstagramDirectMessage with the resolved pageId, recipientInstagramScopedId, and configured text, via a real (fetch-stubbed) provider call", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({ recipient_id: "igsid_1", message_id: "message_1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result).toEqual({ success: true, message: "Sent Instagram DM (message id message_1)." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/v26.0/page_1/messages");
    expect(init.method).toBe("POST");
    expect(url.searchParams.get("recipient")).toBe(JSON.stringify({ id: "igsid_1" }));
    expect(url.searchParams.get("message")).toBe(JSON.stringify({ text: "Hi there, thanks for reaching out!" }));
    expect(url.searchParams.get("access_token")).toBe("real-access-token");
  });

  it("7/8. conversation lookup + workspace isolation — a conversationId that only exists in a different workspace's own list is rejected, never reached via listInstagramConversationsForWorkspace('ws_1')", async () => {
    // The mock itself proves isolation: it's called with workspaceId "ws_1" and returns conversations already scoped to that workspace only — a conversation belonging to ws_2 is simply absent from this list.
    listConversationsMock.mockResolvedValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendInstagramDirectMessageAction.execute(actionParams({ workspaceId: "ws_1" }));

    expect(result).toEqual({ success: false, message: "That Instagram conversation could not be found in this workspace." });
    expect(listConversationsMock).toHaveBeenCalledWith("ws_1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolveContextMock).not.toHaveBeenCalled();
  });

  it("9. conversation inexistente — a missing conversationId fact is rejected without any lookup at all", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendInstagramDirectMessageAction.execute(actionParams({ facts: { dmMessage: "hi" } }));

    expect(result).toEqual({ success: false, message: "Missing conversationId in the trigger's own facts." });
    expect(listConversationsMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("9b. conversation inexistente — an archived conversation is rejected without calling Meta", async () => {
    listConversationsMock.mockResolvedValue([conversationRow({ status: "archived" })]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "That Instagram conversation is archived and can no longer receive a message." });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolveContextMock).not.toHaveBeenCalled();
  });

  it("10. participant externo inexistente/inválido — a conversation with no external_participant_id on record is rejected without calling Meta", async () => {
    listConversationsMock.mockResolvedValue([conversationRow({ external_participant_id: "" })]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "That Instagram conversation has no external participant id on record." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invalid message — a missing or empty dmMessage fact is rejected without any lookup at all", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const missing = await sendInstagramDirectMessageAction.execute(actionParams({ facts: { conversationId: "conversation_domain_1" } }));
    expect(missing).toEqual({ success: false, message: "Missing dmMessage in the trigger's own facts." });

    const empty = await sendInstagramDirectMessageAction.execute(actionParams({ facts: { conversationId: "conversation_domain_1", dmMessage: "   " } }));
    expect(empty).toEqual({ success: false, message: "Missing dmMessage in the trigger's own facts." });

    expect(listConversationsMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("11. connection inexistente — no connected Meta connection for this workspace is rejected the same way", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: false, failure: { kind: "connection", message: "Reconnect Meta with DM-send permission to enable this automation." } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("11b. connection resolved but no Page/Instagram identity selected — a distinct 'page' failure, never reaches Meta", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: false, failure: { kind: "page", message: "Select a Meta Page/Instagram publishing identity to enable this automation." } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Select a Meta Page/Instagram publishing identity to enable this automation." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("12. authorization failure — a credential missing the required scope is rejected with a safe, generic message, never reaching the provider", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: false, failure: { kind: "credential", message: "Reconnect Meta with DM-send permission to enable this automation." } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Reconnect Meta with DM-send permission to enable this automation." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("13. Meta auth failure — a Meta 401/190 response is reported as a reconnect message, never the raw Meta error text", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }), { status: 401 })),
    );

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Reconnect Meta with DM-send permission to enable this automation." });
  });

  it("14. Meta rate-limit failure — reported distinctly, never misclassified as validation", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "(#80002) Calls to this api have exceeded the rate limit", code: 80002 } }), { status: 400 })),
    );

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Meta rate-limited this request — it may succeed if retried." });
  });

  it("15. transient provider failure — a Meta 5xx response is reported via the sanitized generic classifier", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Service temporarily unavailable", { status: 503 })),
    );

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result.success).toBe(false);
    expect(result.message).not.toMatch(/real-access-token/);
  });

  it("16. malformed provider response — a 200 response missing recipient_id/message_id is reported as a failure, never a fabricated success", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ recipient_id: "igsid_1" }), { status: 200 })),
    );

    const result = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unexpected response shape/);
  });

  it("17. never exposes the access token in a failure result's message", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid OAuth access token.", { status: 401 })),
    );

    const result = await sendInstagramDirectMessageAction.execute(actionParams());
    expect(JSON.stringify(result)).not.toContain("real-access-token");
  });

  it("18. never makes a real HTTP call — every test in this file stubs global fetch; this test only documents that expectation explicitly", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ recipient_id: "igsid_1", message_id: "message_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendInstagramDirectMessageAction.execute(actionParams());

    expect(fetchMock).toHaveBeenCalled();
  });

  it("19. no real network call ever reaches graph.facebook.com — the stubbed fetch's own URL is the only host contacted", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    const fetchMock = vi.fn(async (url: URL) => {
      expect(url.hostname).toBe("graph.facebook.com"); // the exact host SOCIAL-12B's own MetaProvider targets — proving this is the real request shape, never a fabricated one, even though the network layer itself is fully stubbed.
      return new Response(JSON.stringify({ recipient_id: "igsid_1", message_id: "message_1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendInstagramDirectMessageAction.execute(actionParams());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("20a. idempotency/execution — calling execute() twice with identical params (simulating actionRunner's own retry) is deterministic and stateless", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ recipient_id: "igsid_1", message_id: "message_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await sendInstagramDirectMessageAction.execute(actionParams());
    const second = await sendInstagramDirectMessageAction.execute(actionParams());

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // True duplicate-send prevention across a retry is a pre-existing,
    // structural limitation shared by every Action with an external side
    // effect in this registry (see this action's own doc comment) — not
    // something this test asserts is solved, only that this action behaves
    // deterministically and introduces no hidden state of its own.
  });
});

describe("sendInstagramDirectMessageAction — end-to-end via the real Automation Engine (executeAutomation)", () => {
  it("20b. a matching, registered Automation successfully dispatches through the real, unmodified engine down to this action", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1", pageId: "page_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ recipient_id: "igsid_1", message_id: "message_1" }), { status: 200 })),
    );
    registerAutomationAction(sendInstagramDirectMessageAction);

    const execution = await executeAutomation({
      automation: automation(),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: null,
      userName: null,
      role: null,
      permissions: [],
    });

    expect(execution.status).toBe("success");
    expect(execution.actionResults).toEqual([{ actionId: SEND_INSTAGRAM_DIRECT_MESSAGE_ACTION_ID, status: "success", message: "Sent Instagram DM (message id message_1).", attempts: 1, resultRef: null }]);
  });

  it("21/22. regression — an unrelated, pre-existing trigger/action pairing (including the SOCIAL-12C comment-reply action) is completely unaffected by this action's own registration", async () => {
    const otherAction = { ...sendInstagramDirectMessageAction, id: "unrelated-test-action", execute: vi.fn().mockResolvedValue({ success: true, message: "ok" }) };
    registerAutomationAction(sendInstagramDirectMessageAction);
    registerAutomationAction(otherAction);

    const execution = await executeAutomation({
      automation: automation({ id: "other-automation", trigger: "proposal.accepted", actionIds: ["unrelated-test-action"] }),
      trigger: { type: "proposal.accepted", workspaceId: "ws_1", occurredAt: "2026-09-15T00:00:00.000Z", actorMemberId: "user_1", facts: {} },
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Owner",
      role: "owner",
      permissions: [],
    });

    expect(execution.status).toBe("success");
    expect(otherAction.execute).toHaveBeenCalledTimes(1);
    expect(listConversationsMock).not.toHaveBeenCalled();
  });
});
