import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/automation/instagramLeadCapture", () => ({
  findOrCreateInstagramLead: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getInstagramCommentById: vi.fn(),
}));
vi.mock("@/core/social/resolveSocialPostForInstagramComment", () => ({
  resolveSocialPostForInstagramComment: vi.fn(),
}));

import createLeadFromInstagramCommentAction, { CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramCommentAction";
import { findOrCreateInstagramLead } from "@/core/automation/instagramLeadCapture";
import { getInstagramCommentById } from "@/lib/data";
import { resolveSocialPostForInstagramComment } from "@/core/social/resolveSocialPostForInstagramComment";
import { registerAutomationAction, resetAutomationActionRegistry, getAutomationAction } from "@/core/automation/actionRegistry";
import { executeAutomation } from "@/core/automation/resolver";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationActionParams, AutomationDefinition, AutomationTriggerEvent } from "@/types/automation";
import type { Lead } from "@/types/lead";
import type { InstagramComment } from "@/types/instagramComment";
import type { SocialPost } from "@/types/socialPost";

const findOrCreateMock = vi.mocked(findOrCreateInstagramLead);
const getCommentByIdMock = vi.mocked(getInstagramCommentById);
const resolvePostMock = vi.mocked(resolveSocialPostForInstagramComment);

function commentFixture(overrides: Partial<InstagramComment> = {}): InstagramComment {
  return {
    id: "comment_domain_1",
    workspace_id: "ws_1",
    instagram_account_identity_id: "identity_1",
    external_comment_id: "external_c1",
    external_media_id: "meta_media_123",
    parent_external_comment_id: null,
    external_author_id: "17841400000000001",
    external_author_username: "curious_bride",
    content: "Do you have June availability?",
    status: "active",
    external_created_at: "2026-09-15T00:00:00.000Z",
    created_at: "2026-09-15T00:00:00.000Z",
    updated_at: "2026-09-15T00:00:00.000Z",
    ...overrides,
  };
}

function socialPostFixture(overrides: Partial<SocialPost> = {}): SocialPost {
  return {
    id: "post_1",
    workspace_id: "ws_1",
    created_by: null,
    status: "published",
    caption: "Behind the scenes",
    asset_id: "asset_1",
    target_provider: "meta",
    target_connection_id: "conn_1",
    target_page_id: "page_1",
    target_instagram_account_id: "ig_account_1",
    provider_container_id: null,
    provider_post_id: "meta_media_123",
    provider_permalink: null,
    provider_error: null,
    published_at: "2026-09-01T00:00:00.000Z",
    scheduled_at: null,
    scheduled_timezone: null,
    publish_attempts: 0,
    next_attempt_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function leadFixture(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead_1",
    workspace_id: "ws_1",
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
    instagram: "@curious_bride",
    instagram_external_id: "17841400000000001",
    source: "Instagram",
    event_type: null,
    event_date: null,
    location: null,
    budget_min: null,
    budget_max: null,
    message: "Do you have June availability?",
    status: "new",
    assigned_to: null,
    converted_client_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function actionParams(overrides: Partial<AutomationActionParams> = {}): AutomationActionParams {
  return {
    workspaceId: "ws_1",
    workspaceName: "Amoré Bloom",
    userId: null,
    userName: null,
    role: null,
    permissions: [],
    facts: { commentId: "comment_domain_1", instagramAccountIdentityId: "identity_1", externalAuthorId: "17841400000000001", hasParent: false, commentText: "Do you have June availability?", externalAuthorUsername: "curious_bride" },
    automationId: "automation_1",
    ...overrides,
  };
}

function trigger(overrides: Partial<AutomationTriggerEvent> = {}): AutomationTriggerEvent {
  return {
    type: "instagram.comment_received",
    workspaceId: "ws_1",
    occurredAt: "2026-09-15T00:00:00.000Z",
    actorMemberId: null,
    facts: { commentId: "comment_domain_1", instagramAccountIdentityId: "identity_1", externalAuthorId: "17841400000000001", hasParent: false, commentText: "Do you have June availability?", externalAuthorUsername: "curious_bride" },
    ...overrides,
  };
}

function automation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "test-lead-capture-comment-automation",
    name: "Test — capture lead from comment",
    description: "Test-only.",
    category: "crm",
    version: "test-v1",
    status: "active",
    trigger: "instagram.comment_received",
    conditions: [],
    actionIds: [CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID],
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
  findOrCreateMock.mockReset();
  getCommentByIdMock.mockReset();
  resolvePostMock.mockReset();
});

describe("createLeadFromInstagramCommentAction — registration", () => {
  it("27. is registered under its own stable id", () => {
    registerAutomationAction(createLeadFromInstagramCommentAction);
    expect(getAutomationAction(CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID)).toBe(createLeadFromInstagramCommentAction);
    expect(CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID).toBe("create-lead-from-instagram-comment");
  });
});

describe("createLeadFromInstagramCommentAction — execute()", () => {
  it("1/2/3/4. creates a Lead using externalAuthorId as instagram_external_id, username as instagram, comment text as message, plus SOCIAL-15C content attribution (instagramCommentId + socialPostId)", async () => {
    getCommentByIdMock.mockResolvedValue(commentFixture());
    resolvePostMock.mockResolvedValue(socialPostFixture());
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    const result = await createLeadFromInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: true, message: "Created a new Lead from this Instagram comment.", resultRef: { type: "lead", id: "lead_1" } });
    expect(getCommentByIdMock).toHaveBeenCalledWith("comment_domain_1", "ws_1");
    expect(resolvePostMock).toHaveBeenCalledWith(commentFixture());
    expect(findOrCreateMock).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      source: "Instagram",
      instagramExternalId: "17841400000000001",
      instagram: "curious_bride",
      message: "Do you have June availability?",
      instagramCommentId: "comment_domain_1",
      socialPostId: "post_1",
      firstName: null,
      lastName: null,
      email: null,
    });
  });

  it("5. a null externalAuthorUsername is preserved as null, never fabricated", async () => {
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture({ instagram: null }), created: true } });

    await createLeadFromInstagramCommentAction.execute(actionParams({ facts: { ...actionParams().facts, externalAuthorUsername: null } }));

    expect(findOrCreateMock).toHaveBeenCalledWith(expect.objectContaining({ instagram: null }));
  });

  it("12/13/14/15/16/17. always passes firstName/lastName/email as null, phone is never part of the input, source is 'Instagram', default status comes from the capture helper untouched", async () => {
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    await createLeadFromInstagramCommentAction.execute(actionParams());

    const callArgs = findOrCreateMock.mock.calls[0][0];
    expect(callArgs.firstName).toBeNull();
    expect(callArgs.lastName).toBeNull();
    expect(callArgs.email).toBeNull();
    expect(callArgs.source).toBe("Instagram");
    expect(callArgs).not.toHaveProperty("phone");
  });

  it("18/20. a duplicate (already-exists) result is reported as success, never a failure, never a second creation", async () => {
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: false } });

    const result = await createLeadFromInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: true, message: "A Lead already exists for this Instagram identity — no duplicate created.", resultRef: { type: "lead", id: "lead_1" } });
  });

  it("25. missing externalAuthorId (no stable identity) never calls the capture helper and fails with a controlled message, never falls back to username", async () => {
    const result = await createLeadFromInstagramCommentAction.execute(actionParams({ facts: { commentId: "comment_domain_1", instagramAccountIdentityId: "identity_1", externalAuthorId: "", hasParent: false, commentText: "hi", externalAuthorUsername: "curious_bride" } }));

    expect(result).toEqual({ success: false, message: "Instagram external identity is required to capture a Lead safely — none was available in this comment's own facts." });
    expect(findOrCreateMock).not.toHaveBeenCalled();
  });

  it("26. malformed facts (externalAuthorId missing entirely) never calls the capture helper", async () => {
    const result = await createLeadFromInstagramCommentAction.execute(actionParams({ facts: { commentId: "comment_domain_1" } }));

    expect(result.success).toBe(false);
    expect(findOrCreateMock).not.toHaveBeenCalled();
  });

  it("a genuine capture-helper failure (e.g. unexpected database error surfaced as a DataResult failure) is passed through as the action's own failure", async () => {
    findOrCreateMock.mockResolvedValue({ success: false, error: "Service unavailable." });

    const result = await createLeadFromInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Service unavailable." });
  });
});

describe("createLeadFromInstagramCommentAction — SOCIAL-15C content attribution", () => {
  it("a Comment with an external_media_id resolving to a real Social Post yields both instagram_comment_id and social_post_id", async () => {
    getCommentByIdMock.mockResolvedValue(commentFixture());
    resolvePostMock.mockResolvedValue(socialPostFixture());
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    await createLeadFromInstagramCommentAction.execute(actionParams());

    expect(findOrCreateMock).toHaveBeenCalledWith(expect.objectContaining({ instagramCommentId: "comment_domain_1", socialPostId: "post_1" }));
  });

  it("a Comment with no external_media_id yields instagram_comment_id but a null social_post_id — a legitimate partial attribution, never a heuristic substitute", async () => {
    getCommentByIdMock.mockResolvedValue(commentFixture({ external_media_id: null }));
    resolvePostMock.mockResolvedValue(null);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    await createLeadFromInstagramCommentAction.execute(actionParams());

    expect(findOrCreateMock).toHaveBeenCalledWith(expect.objectContaining({ instagramCommentId: "comment_domain_1", socialPostId: null }));
  });

  it("a commentId that doesn't resolve to any real InstagramComment row (e.g. it belongs to a different workspace) yields no attribution at all — never a false positive", async () => {
    getCommentByIdMock.mockResolvedValue(null);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    await createLeadFromInstagramCommentAction.execute(actionParams());

    expect(resolvePostMock).not.toHaveBeenCalled();
    expect(findOrCreateMock).toHaveBeenCalledWith(expect.objectContaining({ instagramCommentId: null, socialPostId: null }));
  });

  it("resolves the InstagramComment scoped to this action's own workspaceId — never a bare, unscoped id lookup", async () => {
    getCommentByIdMock.mockResolvedValue(commentFixture({ workspace_id: "ws_other" }));
    resolvePostMock.mockResolvedValue(null);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    await createLeadFromInstagramCommentAction.execute(actionParams({ workspaceId: "ws_a" }));

    expect(getCommentByIdMock).toHaveBeenCalledWith("comment_domain_1", "ws_a");
  });

  it("a missing commentId in facts never calls the comment/post resolution at all, and attribution stays null", async () => {
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    const factsWithoutCommentId = { ...actionParams().facts };
    delete factsWithoutCommentId.commentId;
    await createLeadFromInstagramCommentAction.execute(actionParams({ facts: factsWithoutCommentId }));

    expect(getCommentByIdMock).not.toHaveBeenCalled();
    expect(resolvePostMock).not.toHaveBeenCalled();
    expect(findOrCreateMock).toHaveBeenCalledWith(expect.objectContaining({ instagramCommentId: null, socialPostId: null }));
  });

  it("attribution never depends on username, timestamp, or comment text — only the exact commentId/external_media_id round trip through the repository and resolver", async () => {
    getCommentByIdMock.mockResolvedValue(commentFixture({ external_author_username: "totally_unrelated_handle", content: "no relation to any post caption", external_created_at: "1999-01-01T00:00:00.000Z" }));
    resolvePostMock.mockResolvedValue(socialPostFixture());
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    await createLeadFromInstagramCommentAction.execute(actionParams());

    expect(getCommentByIdMock).toHaveBeenCalledTimes(1);
    expect(resolvePostMock).toHaveBeenCalledTimes(1);
    expect(findOrCreateMock).toHaveBeenCalledWith(expect.objectContaining({ instagramCommentId: "comment_domain_1", socialPostId: "post_1" }));
  });
});

describe("createLeadFromInstagramCommentAction — end-to-end via the real Automation Engine (executeAutomation)", () => {
  it("28. a matching, registered Automation successfully dispatches through the real, unmodified engine down to this action", async () => {
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });
    registerAutomationAction(createLeadFromInstagramCommentAction);

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
    expect(execution.actionResults).toEqual([{ actionId: CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID, status: "success", message: "Created a new Lead from this Instagram comment.", attempts: 1, resultRef: { type: "lead", id: "lead_1" } }]);
  });

  it("regression — an unrelated, pre-existing trigger/action pairing is completely unaffected by this action's own registration", async () => {
    const otherAction = { ...createLeadFromInstagramCommentAction, id: "unrelated-test-action", execute: vi.fn().mockResolvedValue({ success: true, message: "ok" }) };
    registerAutomationAction(createLeadFromInstagramCommentAction);
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
    expect(findOrCreateMock).not.toHaveBeenCalled();
  });
});
