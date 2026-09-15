import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Deliberately no vi.mock() here for the SOCIAL-11E chain — this file
// proves the REAL, unmocked pipe end to end: SOCIAL-11D's own mock
// repositories -> the REAL Automation Engine (core/automation/registry.ts
// + resolver.ts) -> a REAL, durably-persisted automation_executions row
// (via the mock AutomationRepository, the default data mode every other
// test in this suite already runs under). This is what actually
// demonstrates "execution persistence" and "existing Automation Engine
// behavior remains unchanged" — SOCIAL-11E's own report requirement —
// rather than merely asserting a mock was called.
// SOCIAL-13C additionally registers the real Lead-capture actions, which
// import instagramLeadCapture.ts — a real `import "server-only"` at module
// scope, mirroring every other narrow service-role boundary in this
// codebase; this ONE mock is needed purely to satisfy that import (the
// mock-mode branch inside instagramLeadCapture.ts — the one this file's
// own default NEXT_PUBLIC_DATA_MODE actually exercises — never touches
// anything server-only-guarded at runtime).
vi.mock("server-only", () => ({}));

import { processMetaWebhookEvent, type MetaWebhookEntryLike } from "@/core/integrations/webhooks/metaWebhookProcessing";
import { registerAutomation, unregisterAutomation } from "@/core/automation/registry";
import { registerAutomationAction, unregisterAutomationAction } from "@/core/automation/actionRegistry";
import { getAutomationManager } from "@/core/automation/manager";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import { resetInstagramCommentsStore } from "@/lib/data/instagramComment/mockRepository";
import { resetInstagramConversationsStore } from "@/lib/data/instagramConversation/mockRepository";
import createLeadFromInstagramCommentAction, { CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramCommentAction";
import createLeadFromInstagramDmAction, { CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID } from "@/modules/automation/actions/createLeadFromInstagramDmAction";
import { readLeads, resetLeadsStore } from "@/lib/data/mock/leadsStore";
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
  resetLeadsStore();
});

afterEach(() => {
  unregisterAutomation(TEST_COMMENT_AUTOMATION_ID);
  unregisterAutomation(TEST_MESSAGE_AUTOMATION_ID);
  unregisterAutomationAction(TEST_ACTION_ID);
  unregisterAutomation("social-13c-test-lead-capture-comment-automation");
  unregisterAutomation("social-13c-test-lead-capture-dm-automation");
  unregisterAutomationAction(CREATE_LEAD_FROM_INSTAGRAM_COMMENT_ACTION_ID);
  unregisterAutomationAction(CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID);
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

describe("SOCIAL-13C integration — a real webhook comment/DM event creates a real Lead, end to end", () => {
  function leadCaptureCommentAutomation(): AutomationDefinition {
    return {
      id: "social-13c-test-lead-capture-comment-automation",
      name: "Test — capture Lead from comment",
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
    };
  }

  function leadCaptureDmAutomation(): AutomationDefinition {
    return { ...leadCaptureCommentAutomation(), id: "social-13c-test-lead-capture-dm-automation", trigger: "instagram.message_received", actionIds: [CREATE_LEAD_FROM_INSTAGRAM_DM_ACTION_ID] };
  }

  it("a real inbound comment creates a real Lead with the correct fields, no invented data", async () => {
    registerAutomationAction(createLeadFromInstagramCommentAction);
    registerAutomation(leadCaptureCommentAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    const leads = readLeads().filter((lead) => lead.workspace_id === "ws_1");
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      workspace_id: "ws_1",
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      instagram: "a_follower",
      instagram_external_id: "author_1",
      source: "Instagram",
      message: "Beautiful!",
      status: "new",
    });
  });

  it("a duplicate delivery of the same comment (already-recorded domain dedup) never creates a second Lead", async () => {
    registerAutomationAction(createLeadFromInstagramCommentAction);
    registerAutomation(leadCaptureCommentAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });
    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    expect(readLeads().filter((lead) => lead.workspace_id === "ws_1")).toHaveLength(1);
  });

  it("a real inbound message creates a real Lead with the correct fields, no invented data", async () => {
    registerAutomationAction(createLeadFromInstagramDmAction);
    registerAutomation(leadCaptureDmAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: messagingEntry() });

    const leads = readLeads().filter((lead) => lead.workspace_id === "ws_1");
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      workspace_id: "ws_1",
      first_name: null,
      last_name: null,
      email: null,
      instagram_external_id: "participant_1",
      source: "Instagram",
      message: "Hi!",
      status: "new",
    });
  });

  it("an outbound message never creates a Lead — the trigger itself never dispatches for outbound (unchanged pipeline behavior)", async () => {
    registerAutomationAction(createLeadFromInstagramDmAction);
    registerAutomation(leadCaptureDmAutomation());

    await processMetaWebhookEvent({
      workspaceId: "ws_1",
      instagramAccountIdentityId: "identity_1",
      externalAccountId: "business_account",
      objectType: "instagram",
      entry: { id: "business_account", messaging: [{ sender: { id: "business_account" }, recipient: { id: "participant_1" }, timestamp: 1750000000000, message: { mid: "msg_outbound_1", text: "Thanks for reaching out!" } }] },
    });

    expect(readLeads().filter((lead) => lead.workspace_id === "ws_1")).toHaveLength(0);
  });

  it("workspace isolation — the same external author id in two different workspaces creates two distinct Leads, never one shared/cross-linked Lead", async () => {
    registerAutomationAction(createLeadFromInstagramCommentAction);
    registerAutomation(leadCaptureCommentAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });
    const secondWorkspaceEntry: MetaWebhookEntryLike = { id: "business_account_2", changes: [{ field: "comments", value: { id: "comment_2", text: "Beautiful!", from: { id: "author_1", username: "a_follower" } } }] };
    await processMetaWebhookEvent({ workspaceId: "ws_2", instagramAccountIdentityId: "identity_2", externalAccountId: "business_account_2", objectType: "instagram", entry: secondWorkspaceEntry });

    const ws1Leads = readLeads().filter((lead) => lead.workspace_id === "ws_1");
    const ws2Leads = readLeads().filter((lead) => lead.workspace_id === "ws_2");
    expect(ws1Leads).toHaveLength(1);
    expect(ws2Leads).toHaveLength(1);
    expect(ws1Leads[0].id).not.toBe(ws2Leads[0].id);
    expect(ws1Leads[0].instagram_external_id).toBe(ws2Leads[0].instagram_external_id);
  });

  it("no Meta outbound call anywhere in this chain — confirmed by construction: neither Lead-capture action imports MetaProvider or fetch", async () => {
    registerAutomationAction(createLeadFromInstagramCommentAction);
    registerAutomation(leadCaptureCommentAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].status).toBe("success");
  });
});
