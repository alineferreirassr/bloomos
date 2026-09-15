import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  listInstagramCommentsForWorkspace: vi.fn(),
}));
vi.mock("@/core/automation/instagramCommentReplyServiceRole", () => ({
  resolveInstagramCommentReplyContext: vi.fn(),
}));

import replyToInstagramCommentAction, { REPLY_TO_INSTAGRAM_COMMENT_ACTION_ID } from "@/modules/automation/actions/replyToInstagramCommentAction";
import { listInstagramCommentsForWorkspace } from "@/lib/data";
import { resolveInstagramCommentReplyContext } from "@/core/automation/instagramCommentReplyServiceRole";
import { registerAutomationAction, resetAutomationActionRegistry, getAutomationAction } from "@/core/automation/actionRegistry";
import { executeAutomation } from "@/core/automation/resolver";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationActionParams, AutomationDefinition, AutomationTriggerEvent } from "@/types/automation";
import type { InstagramComment } from "@/types/instagramComment";

const listCommentsMock = vi.mocked(listInstagramCommentsForWorkspace);
const resolveContextMock = vi.mocked(resolveInstagramCommentReplyContext);

function actionParams(overrides: Partial<AutomationActionParams> = {}): AutomationActionParams {
  return {
    workspaceId: "ws_1",
    workspaceName: "Amoré Bloom",
    userId: null,
    userName: null,
    role: null,
    permissions: [],
    facts: { commentId: "comment_domain_1", replyMessage: "Thank you so much!" },
    automationId: "automation_1",
    ...overrides,
  };
}

function commentRow(overrides: Partial<InstagramComment> = {}): InstagramComment {
  return {
    id: "comment_domain_1",
    workspace_id: "ws_1",
    instagram_account_identity_id: "identity_1",
    external_comment_id: "external_comment_1",
    external_media_id: "media_1",
    parent_external_comment_id: null,
    external_author_id: "author_1",
    external_author_username: "a_follower",
    content: "Beautiful!",
    status: "active",
    external_created_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function trigger(overrides: Partial<AutomationTriggerEvent> = {}): AutomationTriggerEvent {
  return {
    type: "instagram.comment_received",
    workspaceId: "ws_1",
    occurredAt: "2026-09-15T00:00:00.000Z",
    actorMemberId: null,
    facts: { commentId: "comment_domain_1", replyMessage: "Thank you so much!" },
    ...overrides,
  };
}

function automation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "test-reply-automation",
    name: "Test — reply to comment",
    description: "Test-only.",
    category: "general",
    version: "test-v1",
    status: "active",
    trigger: "instagram.comment_received",
    conditions: [],
    actionIds: [REPLY_TO_INSTAGRAM_COMMENT_ACTION_ID],
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
  listCommentsMock.mockReset();
  resolveContextMock.mockReset();
});

describe("replyToInstagramCommentAction — registration", () => {
  it("1. is registered under its own stable id, matching REPLY_TO_INSTAGRAM_COMMENT_ACTION_ID", () => {
    registerAutomationAction(replyToInstagramCommentAction);
    expect(getAutomationAction(REPLY_TO_INSTAGRAM_COMMENT_ACTION_ID)).toBe(replyToInstagramCommentAction);
    expect(REPLY_TO_INSTAGRAM_COMMENT_ACTION_ID).toBe("reply-to-instagram-comment");
  });
});

describe("replyToInstagramCommentAction — execute()", () => {
  it("2/3/4. successful execution calls MetaProvider.replyToInstagramComment with the resolved external comment id and configured message, via a real (fetch-stubbed) provider call", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    const fetchMock = vi.fn(async (url: URL, init?: RequestInit) => {
      void url;
      void init;
      return new Response(JSON.stringify({ id: "reply_1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await replyToInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: true, message: "Replied to Instagram comment (reply id reply_1)." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/v26.0/external_comment_1/replies");
    expect(init.method).toBe("POST");
    expect(url.searchParams.get("message")).toBe("Thank you so much!");
    expect(url.searchParams.get("access_token")).toBe("real-access-token");
  });

  it("5. workspace isolation — a commentId that only exists in a different workspace's own list is rejected, never reached via listInstagramCommentsForWorkspace('ws_1')", async () => {
    // The mock itself proves isolation: it's called with workspaceId "ws_1" and returns comments already scoped to that workspace only — a comment belonging to ws_2 is simply absent from this list.
    listCommentsMock.mockResolvedValue([]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await replyToInstagramCommentAction.execute(actionParams({ workspaceId: "ws_1" }));

    expect(result).toEqual({ success: false, message: "That Instagram comment could not be found in this workspace." });
    expect(listCommentsMock).toHaveBeenCalledWith("ws_1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolveContextMock).not.toHaveBeenCalled();
  });

  it("6. authorization failure — a credential missing the required scope is rejected with a safe, generic message, never reaching the provider", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: false, failure: { kind: "credential", message: "Reconnect Meta with comment-reply permission to enable this automation." } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await replyToInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Reconnect Meta with comment-reply permission to enable this automation." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("7. missing connection — no connected Meta connection for this workspace is rejected the same way", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: false, failure: { kind: "connection", message: "Reconnect Meta with comment-reply permission to enable this automation." } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await replyToInstagramCommentAction.execute(actionParams());

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("8. invalid comment — a comment that exists but was removed is rejected without calling Meta", async () => {
    listCommentsMock.mockResolvedValue([commentRow({ status: "removed" })]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await replyToInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "That Instagram comment has been removed and can no longer be replied to." });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(resolveContextMock).not.toHaveBeenCalled();
  });

  it("8b. invalid comment — a missing commentId fact is rejected without any lookup at all", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await replyToInstagramCommentAction.execute(actionParams({ facts: { replyMessage: "hi" } }));

    expect(result).toEqual({ success: false, message: "Missing commentId in the trigger's own facts." });
    expect(listCommentsMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("9. invalid message — a missing or empty replyMessage fact is rejected without any lookup at all", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const missing = await replyToInstagramCommentAction.execute(actionParams({ facts: { commentId: "comment_domain_1" } }));
    expect(missing).toEqual({ success: false, message: "Missing replyMessage in the trigger's own facts." });

    const empty = await replyToInstagramCommentAction.execute(actionParams({ facts: { commentId: "comment_domain_1", replyMessage: "   " } }));
    expect(empty).toEqual({ success: false, message: "Missing replyMessage in the trigger's own facts." });

    expect(listCommentsMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("10. provider auth failure — a Meta 401/190 response is reported as a reconnect message, never the raw Meta error text", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid OAuth access token.", code: 190 } }), { status: 401 })),
    );

    const result = await replyToInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Reconnect Meta with comment-reply permission to enable this automation." });
  });

  it("11. provider rate-limit failure — a Meta rate-limit response is reported distinctly, never misclassified as validation", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { message: "(#4) Application request limit reached", code: 4 } }), { status: 400 })),
    );

    const result = await replyToInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Meta rate-limited this request — it may succeed if retried." });
  });

  it("12. provider transient failure — a Meta 5xx response is reported via the sanitized generic classifier", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Service temporarily unavailable", { status: 503 })),
    );

    const result = await replyToInstagramCommentAction.execute(actionParams());

    expect(result.success).toBe(false);
    expect(result.message).not.toMatch(/real-access-token/);
  });

  it("13. malformed provider result — a 200 response missing the reply id is reported as a failure, never a fabricated success", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 })),
    );

    const result = await replyToInstagramCommentAction.execute(actionParams());

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unexpected response shape/);
  });

  it("14/15. idempotency/duplicate execution — calling execute() twice with identical params (simulating actionRunner's own retry) is deterministic, stateless, and posts once per real network call, never silently caching or skipping a second attempt's own real call", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "reply_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await replyToInstagramCommentAction.execute(actionParams());
    const second = await replyToInstagramCommentAction.execute(actionParams());

    expect(first).toEqual(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // True duplicate-reply prevention across a retry is a pre-existing,
    // structural limitation shared by every Action with an external side
    // effect in this registry (see this action's own doc comment) — not
    // something this test asserts is solved, only that this action behaves
    // deterministically and does not introduce its own additional, hidden
    // state across calls.
  });

  it("16. never exposes the access token in a failure result's message", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Invalid OAuth access token.", { status: 401 })),
    );

    const result = await replyToInstagramCommentAction.execute(actionParams());
    expect(JSON.stringify(result)).not.toContain("real-access-token");
  });

  it("17. never makes a real HTTP call — every test in this file stubs global fetch; this test only documents that expectation explicitly", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "reply_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await replyToInstagramCommentAction.execute(actionParams());

    // The stub itself is the proof — if this ever silently fell through to
    // the real global fetch, the stub's own call count would be 0 while a
    // real network error would surface instead of the stubbed 200.
    expect(fetchMock).toHaveBeenCalled();
  });
});

describe("replyToInstagramCommentAction — end-to-end via the real Automation Engine (executeAutomation)", () => {
  it("a matching, registered Automation successfully dispatches through the real, unmodified engine down to this action", async () => {
    listCommentsMock.mockResolvedValue([commentRow()]);
    resolveContextMock.mockResolvedValue({ success: true, accessToken: "real-access-token", connectionId: "conn_1" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ id: "reply_1" }), { status: 200 })),
    );
    registerAutomationAction(replyToInstagramCommentAction);

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
    expect(execution.actionResults).toEqual([{ actionId: REPLY_TO_INSTAGRAM_COMMENT_ACTION_ID, status: "success", message: "Replied to Instagram comment (reply id reply_1).", attempts: 1, resultRef: null }]);
  });

  it("18. regression — an unrelated, pre-existing trigger/action pairing is completely unaffected by this action's own registration", async () => {
    const otherAction = { ...replyToInstagramCommentAction, id: "unrelated-test-action", execute: vi.fn().mockResolvedValue({ success: true, message: "ok" }) };
    registerAutomationAction(replyToInstagramCommentAction);
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
    expect(listCommentsMock).not.toHaveBeenCalled();
  });
});
