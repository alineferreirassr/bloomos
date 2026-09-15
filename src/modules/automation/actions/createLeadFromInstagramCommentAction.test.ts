import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/automation/instagramLeadCapture", () => ({
  findOrCreateInstagramLead: vi.fn(),
}));

import createLeadFromInstagramCommentAction, { CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramCommentAction";
import { findOrCreateInstagramLead } from "@/core/automation/instagramLeadCapture";
import { registerAutomationAction, resetAutomationActionRegistry, getAutomationAction } from "@/core/automation/actionRegistry";
import { executeAutomation } from "@/core/automation/resolver";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationActionParams, AutomationDefinition, AutomationTriggerEvent } from "@/types/automation";
import type { Lead } from "@/types/lead";

const findOrCreateMock = vi.mocked(findOrCreateInstagramLead);

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
});

describe("createLeadFromInstagramCommentAction — registration", () => {
  it("27. is registered under its own stable id", () => {
    registerAutomationAction(createLeadFromInstagramCommentAction);
    expect(getAutomationAction(CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID)).toBe(createLeadFromInstagramCommentAction);
    expect(CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID).toBe("create-lead-from-instagram-comment");
  });
});

describe("createLeadFromInstagramCommentAction — execute()", () => {
  it("1/2/3/4. creates a Lead using externalAuthorId as instagram_external_id, username as instagram, comment text as message", async () => {
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    const result = await createLeadFromInstagramCommentAction.execute(actionParams());

    expect(result).toEqual({ success: true, message: "Created a new Lead from this Instagram comment.", resultRef: { type: "lead", id: "lead_1" } });
    expect(findOrCreateMock).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      source: "Instagram",
      instagramExternalId: "17841400000000001",
      instagram: "curious_bride",
      message: "Do you have June availability?",
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
