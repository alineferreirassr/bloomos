import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data", () => ({
  listInstagramConversationsForWorkspace: vi.fn(),
}));
vi.mock("@/core/automation/instagramLeadCapture", () => ({
  findOrCreateInstagramLead: vi.fn(),
}));

import createLeadFromInstagramDmAction, { CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramDmAction";
import { listInstagramConversationsForWorkspace } from "@/lib/data";
import { findOrCreateInstagramLead } from "@/core/automation/instagramLeadCapture";
import { registerAutomationAction, resetAutomationActionRegistry, getAutomationAction } from "@/core/automation/actionRegistry";
import { executeAutomation } from "@/core/automation/resolver";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationActionParams, AutomationDefinition, AutomationTriggerEvent } from "@/types/automation";
import type { Lead } from "@/types/lead";
import type { InstagramConversation } from "@/types/instagramConversation";

const listConversationsMock = vi.mocked(listInstagramConversationsForWorkspace);
const findOrCreateMock = vi.mocked(findOrCreateInstagramLead);

function conversationRow(overrides: Partial<InstagramConversation> = {}): InstagramConversation {
  return {
    id: "conversation_domain_1",
    workspace_id: "ws_1",
    instagram_account_identity_id: "identity_1",
    external_conversation_id: null,
    external_participant_id: "17841400000000042",
    external_participant_username: "curious_bride",
    status: "active",
    last_message_at: "2026-09-15T00:00:00.000Z",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
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
    instagram: "curious_bride",
    instagram_external_id: "17841400000000042",
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
    facts: { messageId: "message_domain_1", conversationId: "conversation_domain_1", instagramAccountIdentityId: "identity_1", direction: "inbound", messageText: "Do you have June availability?", externalParticipantUsername: "curious_bride" },
    automationId: "automation_1",
    ...overrides,
  };
}

function trigger(overrides: Partial<AutomationTriggerEvent> = {}): AutomationTriggerEvent {
  return {
    type: "instagram.message_received",
    workspaceId: "ws_1",
    occurredAt: "2026-09-15T00:00:00.000Z",
    actorMemberId: null,
    facts: { messageId: "message_domain_1", conversationId: "conversation_domain_1", instagramAccountIdentityId: "identity_1", direction: "inbound", messageText: "Do you have June availability?", externalParticipantUsername: "curious_bride" },
    ...overrides,
  };
}

function automation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "test-lead-capture-dm-automation",
    name: "Test — capture lead from DM",
    description: "Test-only.",
    category: "crm",
    version: "test-v1",
    status: "active",
    trigger: "instagram.message_received",
    conditions: [],
    actionIds: [CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID],
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
  listConversationsMock.mockReset();
  findOrCreateMock.mockReset();
});

describe("createLeadFromInstagramDmAction — registration", () => {
  it("27. is registered under its own stable id", () => {
    registerAutomationAction(createLeadFromInstagramDmAction);
    expect(getAutomationAction(CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID)).toBe(createLeadFromInstagramDmAction);
    expect(CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID).toBe("create-lead-from-instagram-dm");
  });
});

describe("createLeadFromInstagramDmAction — execute()", () => {
  it("6/7/8/9. creates a Lead using the conversation's own external_participant_id as instagram_external_id, username as instagram, message text as message", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    const result = await createLeadFromInstagramDmAction.execute(actionParams());

    expect(result).toEqual({ success: true, message: "Created a new Lead from this Instagram DM.", resultRef: { type: "lead", id: "lead_1" } });
    expect(listConversationsMock).toHaveBeenCalledWith("ws_1");
    expect(findOrCreateMock).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      source: "Instagram",
      instagramExternalId: "17841400000000042",
      instagram: "curious_bride",
      message: "Do you have June availability?",
      firstName: null,
      lastName: null,
      email: null,
    });
  });

  it("11. a null externalParticipantUsername is preserved as null, never fabricated", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture({ instagram: null }), created: true } });

    await createLeadFromInstagramDmAction.execute(actionParams({ facts: { ...actionParams().facts, externalParticipantUsername: null } }));

    expect(findOrCreateMock).toHaveBeenCalledWith(expect.objectContaining({ instagram: null }));
  });

  it("10. a null messageText is preserved as null, never fabricated", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture({ message: null }), created: true } });

    await createLeadFromInstagramDmAction.execute(actionParams({ facts: { ...actionParams().facts, messageText: null } }));

    expect(findOrCreateMock).toHaveBeenCalledWith(expect.objectContaining({ message: null }));
  });

  it("12/13/14/15/16. always passes firstName/lastName/email as null, source is 'Instagram'", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });

    await createLeadFromInstagramDmAction.execute(actionParams());

    const callArgs = findOrCreateMock.mock.calls[0][0];
    expect(callArgs.firstName).toBeNull();
    expect(callArgs.lastName).toBeNull();
    expect(callArgs.email).toBeNull();
    expect(callArgs.source).toBe("Instagram");
  });

  it("18/20. a duplicate (already-exists) result is reported as success, never a failure, never a second creation", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: false } });

    const result = await createLeadFromInstagramDmAction.execute(actionParams());

    expect(result).toEqual({ success: true, message: "A Lead already exists for this Instagram identity — no duplicate created.", resultRef: { type: "lead", id: "lead_1" } });
  });

  it("24. an outbound message never calls listInstagramConversationsForWorkspace or the capture helper, fails with a controlled message", async () => {
    const result = await createLeadFromInstagramDmAction.execute(actionParams({ facts: { ...actionParams().facts, direction: "outbound" } }));

    expect(result).toEqual({ success: false, message: "Only an inbound Instagram DM can capture a Lead — this message was outbound." });
    expect(listConversationsMock).not.toHaveBeenCalled();
    expect(findOrCreateMock).not.toHaveBeenCalled();
  });

  it("26. missing conversationId (malformed facts) never calls the capture helper", async () => {
    const result = await createLeadFromInstagramDmAction.execute(actionParams({ facts: { messageId: "message_domain_1", direction: "inbound" } }));

    expect(result).toEqual({ success: false, message: "Missing conversationId in the trigger's own facts." });
    expect(listConversationsMock).not.toHaveBeenCalled();
    expect(findOrCreateMock).not.toHaveBeenCalled();
  });

  it("25. a conversation that cannot be resolved in this workspace (no stable identity) never calls the capture helper", async () => {
    listConversationsMock.mockResolvedValue([]);

    const result = await createLeadFromInstagramDmAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Instagram external identity is required to capture a Lead safely — none was available for this conversation." });
    expect(findOrCreateMock).not.toHaveBeenCalled();
  });

  it("23. workspace isolation — a conversationId that only exists in a different workspace's own list is never found, never leaks into the capture helper", async () => {
    listConversationsMock.mockResolvedValue([]);

    const result = await createLeadFromInstagramDmAction.execute(actionParams({ workspaceId: "ws_1" }));

    expect(listConversationsMock).toHaveBeenCalledWith("ws_1");
    expect(result.success).toBe(false);
    expect(findOrCreateMock).not.toHaveBeenCalled();
  });

  it("a genuine capture-helper failure is passed through as the action's own failure", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    findOrCreateMock.mockResolvedValue({ success: false, error: "Service unavailable." });

    const result = await createLeadFromInstagramDmAction.execute(actionParams());

    expect(result).toEqual({ success: false, message: "Service unavailable." });
  });
});

describe("createLeadFromInstagramDmAction — end-to-end via the real Automation Engine (executeAutomation)", () => {
  it("28. a matching, registered Automation successfully dispatches through the real, unmodified engine down to this action", async () => {
    listConversationsMock.mockResolvedValue([conversationRow()]);
    findOrCreateMock.mockResolvedValue({ success: true, data: { lead: leadFixture(), created: true } });
    registerAutomationAction(createLeadFromInstagramDmAction);

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
    expect(execution.actionResults).toEqual([{ actionId: CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID, status: "success", message: "Created a new Lead from this Instagram DM.", attempts: 1, resultRef: { type: "lead", id: "lead_1" } }]);
  });

  it("regression — an unrelated, pre-existing trigger/action pairing (including the SOCIAL-12C/12D/comment-capture actions) is completely unaffected by this action's own registration", async () => {
    const otherAction = { ...createLeadFromInstagramDmAction, id: "unrelated-test-action", execute: vi.fn().mockResolvedValue({ success: true, message: "ok" }) };
    registerAutomationAction(createLeadFromInstagramDmAction);
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
    expect(findOrCreateMock).not.toHaveBeenCalled();
  });
});
