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
import createLeadFromInstagramCommentAction from "@/modules/automation/actions/createLeadFromInstagramCommentAction";
import createLeadFromInstagramDmAction from "@/modules/automation/actions/createLeadFromInstagramDmAction";
import captureLeadFromInstagramComment, { CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID } from "@/modules/automation/definitions/captureLeadFromInstagramComment";
import captureLeadFromInstagramDm, { CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID } from "@/modules/automation/definitions/captureLeadFromInstagramDm";
import { readLeads, resetLeadsStore } from "@/lib/data/mock/leadsStore";
import type { AutomationActionDefinition, AutomationDefinition } from "@/types/automation";

// SOCIAL-13H — `metaWebhookProcessing.ts` now calls
// `registerAutomationDefinitions()` at its own module scope, so by the time
// ANY test below runs, `capture-lead-from-instagram-comment`/
// `capture-lead-from-instagram-dm` are ALREADY registered and ACTIVE —
// exactly the real production state this default-wiring checkpoint exists
// to guarantee. Every `commentEntry()`/`messagingEntry()` dispatch in this
// file therefore now also runs the matching default Automation, in
// addition to whatever a given test registers for itself; the assertions
// below account for that one extra execution wherever the trigger types
// overlap. This file deliberately never wipes the registry between tests
// (no `resetAutomationRegistry()`), matching every other integration test
// in this codebase's own established pattern of explicit, additive
// per-test registration plus scoped `afterEach` cleanup for test-only ids —
// the 2 real defaults are meant to behave exactly as they would in a real,
// warm production process: registered once, present for every request.

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
  // SOCIAL-13H — `createLeadFromInstagramCommentAction`/`-Dm` and the 2
  // default Automation Definitions that use them are now real, permanent,
  // process-wide registrations (via `metaWebhookProcessing.ts`'s own
  // module-level `registerAutomationDefinitions()` call, exactly like they
  // would be in a real running server) — they are deliberately never
  // unregistered here, unlike `TEST_ACTION_ID`/the `TEST_*_AUTOMATION_ID`s
  // above, which really are test-only and must not leak between tests.
});

describe("SOCIAL-11E integration — real Automation Engine, real durable execution persistence", () => {
  it("execution persistence — a matching workflow's dispatch creates a real, durably-persisted automation_executions row", async () => {
    registerAutomationAction(testAction);
    registerAutomation(commentAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    // SOCIAL-13H — the always-on default `capture-lead-from-instagram-comment`
    // Automation fires alongside this test's own automation now: 2
    // executions, not 1 (see this file's own top-level comment).
    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(2);
    expect(recent.find((execution) => execution.automationId === TEST_COMMENT_AUTOMATION_ID)).toMatchObject({ trigger: "instagram.comment_received", workspaceId: "ws_1", status: "success" });
  });

  it("DM/message matching workflow also creates a real, durably-persisted execution", async () => {
    registerAutomationAction(testAction);
    registerAutomation(messageAutomation());

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: messagingEntry() });

    // SOCIAL-13H — same reasoning as the comment test above, for the DM default.
    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(2);
    expect(recent.find((execution) => execution.automationId === TEST_MESSAGE_AUTOMATION_ID)).toMatchObject({ trigger: "instagram.message_received" });
  });

  it("non-matching workflow — an automation registered for a different trigger never runs for an Instagram event", async () => {
    registerAutomationAction(testAction);
    registerAutomation({ ...commentAutomation(), trigger: "proposal.accepted" });

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    // SOCIAL-13H — the mismatched-trigger automation still never runs; only
    // the always-on default Instagram Lead-capture Automation does.
    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].automationId).toBe(CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID);
  });

  it("SOCIAL-13H — no manually-registered automation at all still captures a Lead: the default Automation Definition runs on its own, superseding SOCIAL-11E's prior dormant-by-default state", async () => {
    await expect(
      processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() }),
    ).resolves.toBeUndefined();
    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].automationId).toBe(CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID);
    expect(recent[0].status).toBe("success");
  });

  it("multiple matching automations — every active automation registered for the trigger runs, matching the engine's own existing fan-out contract", async () => {
    registerAutomationAction(testAction);
    registerAutomation(commentAutomation());
    registerAutomation({ ...commentAutomation(), id: "social-11e-test-second-comment-automation" });

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    // SOCIAL-13H — 3 total: the two test automations plus the always-on default.
    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(3);
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

    // SOCIAL-13H — the disabled test automation still never runs; only the
    // always-on default fires.
    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].automationId).toBe(CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID);
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
  // SOCIAL-13H — these tests used to register their own hand-rolled
  // lookalike Automation (a stand-in for the Workflow a workspace admin
  // would have had to build manually, pre-SOCIAL-13H). Now that a real
  // default Definition exists and ships registered by default, these tests
  // register the REAL `captureLeadFromInstagramComment`/`-Dm` objects
  // instead — proving the actual shipped wiring end to end, not a
  // proxy for it. (`registerAutomation()` keys by id and is idempotent, so
  // this is a harmless overwrite of the same entry `metaWebhookProcessing.ts`'s
  // own module-level call already registered — kept explicit here to match
  // this file's own established "explicit setup per test" style.)

  it("a real inbound comment creates a real Lead with the correct fields, no invented data", async () => {
    registerAutomationAction(createLeadFromInstagramCommentAction);
    registerAutomation(captureLeadFromInstagramComment);

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
    registerAutomation(captureLeadFromInstagramComment);

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });
    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    expect(readLeads().filter((lead) => lead.workspace_id === "ws_1")).toHaveLength(1);
  });

  it("a real inbound message creates a real Lead with the correct fields, no invented data", async () => {
    registerAutomationAction(createLeadFromInstagramDmAction);
    registerAutomation(captureLeadFromInstagramDm);

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
    registerAutomation(captureLeadFromInstagramDm);

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
    registerAutomation(captureLeadFromInstagramComment);

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
    registerAutomation(captureLeadFromInstagramComment);

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0].status).toBe("success");
  });
});

describe("SOCIAL-13H integration — default (code-registered) wiring, without any manually-authored Workflow", () => {
  const CUSTOM_WORKFLOW_AUTOMATION_ID = "social-13h-test-custom-workflow-comment-automation";

  afterEach(() => {
    unregisterAutomation(CUSTOM_WORKFLOW_AUTOMATION_ID);
  });

  it("an inbound comment captures a real Lead with zero manual registration of any kind — proves the shipped default, not a stand-in for it", async () => {
    await expect(
      processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() }),
    ).resolves.toBeUndefined();

    const leads = readLeads().filter((lead) => lead.workspace_id === "ws_1");
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ instagram_external_id: "author_1", instagram: "a_follower", source: "Instagram", status: "new", first_name: null, last_name: null, email: null });

    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ automationId: CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID, status: "success" });
  });

  it("an inbound DM captures a real Lead with zero manual registration of any kind — proves the shipped default, not a stand-in for it", async () => {
    await expect(
      processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: messagingEntry() }),
    ).resolves.toBeUndefined();

    const leads = readLeads().filter((lead) => lead.workspace_id === "ws_1");
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({ instagram_external_id: "participant_1", source: "Instagram", status: "new", first_name: null, last_name: null, email: null });

    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ automationId: CAPTURE_LEAD_FROM_INSTAGRAM_DM_AUTOMATION_ID, status: "success" });
  });

  it("a comment with no resolvable external author identity never captures a Lead, even with the default active — the Action's own existing guard is unchanged", async () => {
    const entryMissingAuthorId: MetaWebhookEntryLike = { id: "business_account", changes: [{ field: "comments", value: { id: "comment_no_author", text: "Beautiful!", from: { username: "a_follower" } } }] };

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: entryMissingAuthorId });

    // `parseCommentValue` itself requires `from.id` — no domain comment is
    // even created, so no trigger is dispatched and no execution exists at
    // all (matching `metaWebhookProcessing.test.ts`'s own unit-level proof
    // of this same guard).
    expect(readLeads().filter((lead) => lead.workspace_id === "ws_1")).toHaveLength(0);
    expect(await getAutomationManager().getRecentExecutions("ws_1", 10)).toHaveLength(0);
  });

  it("a workspace's own hand-built Workflow on the exact same trigger/action pair as the default runs alongside it, but never produces a duplicate Lead — both executions still individually succeed", async () => {
    // Simulates a workspace admin who separately built their own Workflow
    // through the Workflow Builder selecting the same trigger and action —
    // a different Automation id, identical trigger/action.
    registerAutomation({ ...captureLeadFromInstagramComment, id: CUSTOM_WORKFLOW_AUTOMATION_ID, name: "Workspace's own custom Workflow" });

    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    // Exactly one Lead — `findOrCreateInstagramLead`'s own dedup makes the
    // second automation's own execution a benign "already exists" no-op,
    // never a second insert.
    expect(readLeads().filter((lead) => lead.workspace_id === "ws_1")).toHaveLength(1);

    // Both automations still ran independently and both still report
    // success — dispatch fan-out itself is untouched by this checkpoint;
    // only Lead creation itself is deduplicated, at the domain layer.
    const recent = await getAutomationManager().getRecentExecutions("ws_1", 10);
    expect(recent).toHaveLength(2);
    expect(recent.every((execution) => execution.status === "success")).toBe(true);
    expect(recent.map((execution) => execution.automationId).sort()).toEqual([CAPTURE_LEAD_FROM_INSTAGRAM_COMMENT_AUTOMATION_ID, CUSTOM_WORKFLOW_AUTOMATION_ID].sort());
  });

  it("repeated webhook delivery of the same comment (idempotency layer 1, unchanged) never creates a second Lead even with the default active", async () => {
    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });
    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });
    await processMetaWebhookEvent({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "business_account", objectType: "instagram", entry: commentEntry() });

    expect(readLeads().filter((lead) => lead.workspace_id === "ws_1")).toHaveLength(1);
    // Only the FIRST delivery ever reaches a trigger dispatch — the domain
    // dedup in `processCommentChange` returns early for the 2nd/3rd
    // (`existing` comment found), so exactly 1 execution, not 3.
    expect(await getAutomationManager().getRecentExecutions("ws_1", 10)).toHaveLength(1);
  });
});
