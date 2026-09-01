import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/documents/manager", () => ({
  getDocumentsManager: vi.fn(),
}));

import generateDocumentAction, { GENERATE_DOCUMENT_ACTION_ID } from "@/modules/automation/actions/generateDocumentAction";
import { getDocumentsManager } from "@/core/documents/manager";
import { registerAutomationAction, resetAutomationActionRegistry } from "@/core/automation/actionRegistry";
import { executeAutomation } from "@/core/automation/resolver";
import { resetAutomationStore } from "@/lib/data/core/automation/mockRepository";
import type { AutomationDefinition, AutomationTriggerEvent } from "@/types/automation";

function trigger(overrides: Partial<AutomationTriggerEvent> = {}): AutomationTriggerEvent {
  return { type: "proposal.accepted", workspaceId: "ws_1", occurredAt: "2026-08-17T00:00:00.000Z", actorMemberId: "user_1", facts: { templateId: "template_1", clientId: "client_1" }, ...overrides };
}

function automation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "workflow-wf_2-trigger-t1-path-0",
    name: "Test Workflow",
    description: "A compiled Workflow for authorization-floor tests.",
    category: "general",
    version: "workflow-wf_2-v1",
    status: "active",
    trigger: "proposal.accepted",
    conditions: [],
    actionIds: [GENERATE_DOCUMENT_ACTION_ID],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    metadata: { workflowId: "wf_2", workflowVersion: 1, sourceNodeIds: [] },
    workflow: null,
    ...overrides,
  };
}

afterEach(() => {
  resetAutomationActionRegistry();
  resetAutomationStore();
  vi.mocked(getDocumentsManager).mockReset();
});

describe("generateDocumentAction authorization floor (Phase 09B.1)", () => {
  it("is registered with the same permission every real DocumentType.requiredPermissions already uses", () => {
    expect(generateDocumentAction.requiredPermissions).toEqual(["documents.create"]);
  });

  it("A — caller has the action's own authorization floor -> the underlying mutation runs", async () => {
    const compileAndCreateDocument = vi.fn().mockResolvedValue({ success: true, document: { id: "doc_1", metadata: { title: "Welcome Guide" } } });
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);
    registerAutomationAction(generateDocumentAction);

    const execution = await executeAutomation({
      automation: automation(),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Owner",
      role: "owner",
      permissions: ["documents.create"],
    });

    expect(execution.status).toBe("success");
    expect(compileAndCreateDocument).toHaveBeenCalledTimes(1);
  });

  it("B/E — a weak (empty) Workflow executionPolicy cannot substitute for the caller lacking the action's own floor -> DENIED, mutation never runs", async () => {
    const compileAndCreateDocument = vi.fn();
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);
    registerAutomationAction(generateDocumentAction);

    const execution = await executeAutomation({
      automation: automation({ requiredPermissions: [] }),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_2",
      userName: "Staff Member",
      role: "staff",
      permissions: [], // caller lacks documents.create
    });

    expect(execution.status).toBe("failure");
    expect(execution.actionResults[0]).toMatchObject({ actionId: GENERATE_DOCUMENT_ACTION_ID, status: "failure" });
    expect(compileAndCreateDocument).not.toHaveBeenCalled();
  });

  it("C — a Workflow that explicitly requires the same permission, with a caller who has it, still succeeds", async () => {
    const compileAndCreateDocument = vi.fn().mockResolvedValue({ success: true, document: { id: "doc_2", metadata: { title: "Welcome Guide" } } });
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);
    registerAutomationAction(generateDocumentAction);

    const execution = await executeAutomation({
      automation: automation({ requiredPermissions: ["documents.create"] }),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Owner",
      role: "owner",
      permissions: ["documents.create"],
    });

    expect(execution.status).toBe("success");
    expect(compileAndCreateDocument).toHaveBeenCalledTimes(1);
  });

  it("D — a Workflow that adds an additional restriction on top of the action floor still enforces it", async () => {
    const compileAndCreateDocument = vi.fn();
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);
    registerAutomationAction(generateDocumentAction);

    // Workflow author additionally requires "workspace.manage" — caller has the action's own floor
    // (documents.create) but not this extra, Workflow-added restriction.
    const execution = await executeAutomation({
      automation: automation({ requiredPermissions: ["workspace.manage"] }),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Manager",
      role: "manager",
      permissions: ["documents.create"],
    });

    expect(execution.status).toBe("failure");
    expect(execution.actionResults).toEqual([]); // denied at the Automation-level gate, before the action loop even starts
    expect(compileAndCreateDocument).not.toHaveBeenCalled();
  });

  it("F — denial happens before the business mutation, for the missing-action-floor case specifically", async () => {
    const compileAndCreateDocument = vi.fn();
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);
    registerAutomationAction(generateDocumentAction);

    await executeAutomation({
      automation: automation(),
      trigger: trigger(),
      workspaceName: "Amoré Bloom",
      userId: "user_2",
      userName: "Staff",
      role: "staff",
      permissions: [],
    });

    expect(compileAndCreateDocument).not.toHaveBeenCalled();
  });

  it("G — a successful compile is scoped to the trigger's own workspace, never a caller-suppliable value", async () => {
    const compileAndCreateDocument = vi.fn().mockResolvedValue({ success: true, document: { id: "doc_3", metadata: { title: "Welcome Guide" } } });
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);
    registerAutomationAction(generateDocumentAction);

    await executeAutomation({
      automation: automation(),
      trigger: trigger({ workspaceId: "ws_7" }),
      workspaceName: "Amoré Bloom",
      userId: "user_1",
      userName: "Owner",
      role: "owner",
      permissions: ["documents.create"],
    });

    expect(compileAndCreateDocument).toHaveBeenCalledWith(
      "template_1",
      expect.objectContaining({ workspaceId: "ws_7", clientId: "client_1" }),
      expect.objectContaining({ permissions: ["documents.create"], role: "owner" }),
    );
  });
});
