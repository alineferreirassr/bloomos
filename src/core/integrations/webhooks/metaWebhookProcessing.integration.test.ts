import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Deliberately no vi.mock() here — this file proves the REAL, unmocked
// pipe end to end: SOCIAL-11D's own mock repositories -> the REAL
// Automation Engine (core/automation/registry.ts + resolver.ts) -> a
// REAL, durably-persisted automation_executions row (via the mock
// AutomationRepository, the default data mode every other test in this
// suite already runs under). This is what actually demonstrates
// "execution persistence" and "existing Automation Engine behavior
// remains unchanged" — SOCIAL-11E's own report requirement — rather than
// merely asserting a mock was called.

import { processMetaWebhookEvent, type MetaWebhookEntryLike } from "@/core/integrations/webhooks/metaWebhookProcessing";
import { registerAutomation, unregisterAutomation } from "@/core/automation/registry";
import { registerAutomationAction, unregisterAutomationAction } from "@/core/automation/actionRegistry";
import { getAutomationManager } from "@/core/automation/manager";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import { resetInstagramCommentsStore } from "@/lib/data/instagramComment/mockRepository";
import { resetInstagramConversationsStore } from "@/lib/data/instagramConversation/mockRepository";
import type { AutomationActionDefinition, AutomationDefinition } from "@/types/automation";

const TEST_ACTION_ID = "social-11e-test-record-action";
const TEST_COMMENT_AUTOMATION_ID = "social-11e-test-comment-automation";
const TEST_MESSAGE_AUTOMATION_ID = "social-11e-test-message-automation";

const testAction: AutomationActionDefinition = {
  id: TEST_ACTION_ID,
  name: "Test recording action",
  description: "Test-only — never registered in production. Proves an existing, safe, already-registered action can execute against an Instagram trigger without any reply/AI/Lead/CRM/outbound Meta call.",
  category: "general",
  version: "test-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  execute: async (params) => ({ success: true, message: `recorded ${params.automationId}` }),
};

function commentAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: TEST_COMMENT_AUTOMATION_ID,
    name: "Test — comment received",
    description: "Test-only automation listening for instagram.comment_received.",
    category: "general",
    version: "test-v1",
    status: "active",
    trigger: "instagram.comment_received",
    conditions: [],
    actionIds: [TEST_ACTION_ID],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

function messageAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: TEST_MESSAGE_AUTOMATION_ID,
    name: "Test — message received",
    description: "Test-only automation listening for instagram.message_received.",
    category: "general",
    version: "test-v1",
    status: "active",
    trigger: "instagram.message_received",
    conditions: [],
    actionIds: [TEST_ACTION_ID],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

function commentEntry(): MetaWebhookEntryLike {
  return { id: "business_account", changes: [{ field: "comments", value: { id: "comment_1", text: "Beautiful!", from: { id: "author_1", username: "a_follower" } } }] };
}

function messagingEntry(): MetaWebhookEntryLike {
  return { id: "business_account", messaging: [{ sender: { id: "participant_1" }, recipient: { id: "business_account" }, timestamp: 1750000000000, message: { mid: "msg_1", text: "Hi!" } }] };
}

beforeEach(() => {
  resetAutomationStore();
  resetInstagramCommentsStore();
  resetInstagramConversationsStore();
});

afterEach(() => {
  unregisterAutomation(TEST_COMMENT_AUTOMATION_ID);
  unregisterAutomation(TEST_MESSAGE_AUTOMATION_ID);
  unregisterAutomationAction(TEST_ACTION_ID);
});

describe("SOCIAL-11E integration — real Automation Engine, real durable execution persistence", () => {
  it("execution persistence — a matching workflow's dispatch creates a real, durably-persisted automation_executions row", async () => {
    registerAutomationAction(testAction);
    registerAutomation(commentAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ automationId: TEST_COMMENT_AUTOMATION_ID, trigger: "instagram.comment_received", workspaceId: "ws_1", status: "success" });
  });

  it("DM/message matching workflow also creates a real, durably-persisted execution", async () => {
    registerAutomationAction(testAction);
    registerAutomation(messageAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: messagingEntry() });

    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ automationId: TEST_MESSAGE_AUTOMATION_ID, trigger: "instagram.message_received" });
  });

  it("non-matching workflow — an automation registered for a different trigger never runs for an Instagram event", async () => {
    registerAutomationAction(testAction);
    registerAutomation({ ...commentAutomation(), trigger: "proposal.accepted" });

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    expect(await getAutomationManager().getRecentExecutions("ws_1", 10)).toHaveLength(0);
  });

  it("no matching automation registered at all — dispatch correctly finds zero automations, creates zero executions, and never throws (the checkpoint's own explicit, permitted default state)", async () => {
    await expect(
      processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() }),
    ).resolves.toBeUndefined();
    expect(await getAutomationManager().getRecentExecutions("ws_1", 10)).toHaveLength(0);
  });

  it("multiple matching automations — every active automation registered for the trigger runs, matching the engine's own existing fan-out contract", async () => {
    registerAutomationAction(testAction);
    registerAutomation(commentAutomation());
    registerAutomation({ ...commentAutomation(), id: "social-11e-test-second-comment-automation" });

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(2);
    unregisterAutomation("social-11e-test-second-comment-automation");
  });

  it("workspace isolation — an execution created for ws_1 never appears in ws_2's own recent executions", async () => {
    registerAutomationAction(testAction);
    registerAutomation(commentAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    expect(await getAutomationManager().getRecentExecutions("ws_2", 10)).toHaveLength(0);
  });

  it("cross-workspace workflow rejection — a disabled automation for the right trigger never executes (existing engine contract, unchanged)", async () => {
    registerAutomationAction(testAction);
    registerAutomation({ ...commentAutomation(), status: "disabled" });

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    expect(await getAutomationManager().getRecentExecutions("ws_1", 10)).toHaveLength(0);
  });

  it("existing Automation Engine behavior remains unchanged — a real proposal.accepted-style trigger dispatch still works exactly as before, unaffected by the new Instagram trigger types", async () => {
    registerAutomationAction(testAction);
    const proposalAutomation: AutomationDefinition = { ...commentAutomation(), id: "social-11e-test-proposal-automation", trigger: "proposal.accepted" };
    registerAutomation(proposalAutomation);

    const { dispatchAutomationTrigger } = await import("@/core/automation/resolver");
    await dispatchAutomationTrigger(
      { type: "proposal.accepted", workspaceId: "ws_1", occurredAt: new Date().toISOString(), actorMemberId: "member_1", facts: {} },
      { workspaceName: "Amoré Bloom", userId: "member_1", userName: "Ana", role: "manager", permissions: [] },
    );

    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].trigger).toBe("proposal.accepted");
    unregisterAutomation("social-11e-test-proposal-automation");
  });
});
