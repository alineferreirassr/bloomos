import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/documents/manager", () => ({ getDocumentsManager: vi.fn() }));
vi.mock("@/modules/documentTemplates/resolvePublishedTemplate", () => ({
  resolvePublishedTemplate: vi.fn(),
  mergeContextEntityIdsFromFacts: vi.fn((facts: Record<string, unknown>) => ({
    clientId: typeof facts.clientId === "string" ? facts.clientId : undefined,
    eventId: typeof facts.eventId === "string" ? facts.eventId : undefined,
  })),
}));

import { makeGenerateDocumentAction } from "@/modules/automation/actions/generateDocumentActionFactory";
import { getDocumentsManager } from "@/core/documents/manager";
import { resolvePublishedTemplate } from "@/modules/documentTemplates/resolvePublishedTemplate";
import type { AutomationActionParams } from "@/types/automation";

function makeParams(overrides: Partial<AutomationActionParams> = {}): AutomationActionParams {
  return {
    workspaceId: "ws_1",
    workspaceName: "Amoré Bloom",
    userId: "member_1",
    userName: "Owner",
    role: "owner",
    permissions: ["documents.create"],
    facts: { clientId: "client_1", eventId: "event_1" },
    automationId: "workflow-wf_1-trigger-invoice.overdue-path-0",
    ...overrides,
  };
}

const spec = { id: "generate-contract-document", name: "Generate Contract", description: "test", documentTypeId: "contract" as const, category: "crm" as const };

describe("makeGenerateDocumentAction", () => {
  it("fails without compiling when no Template is published for this document type", async () => {
    vi.mocked(resolvePublishedTemplate).mockResolvedValue(null);
    const action = makeGenerateDocumentAction(spec);
    const result = await action.execute(makeParams());
    expect(result.success).toBe(false);
    expect(result.message).toContain("No published");
  });

  it("compiles through the Documents Manager using the resolved Template and trigger facts", async () => {
    vi.mocked(resolvePublishedTemplate).mockResolvedValue({ id: "template_1", name: "Wedding Contract" } as never);
    const compileAndCreateDocument = vi.fn().mockResolvedValue({ success: true, document: { id: "document_1" } });
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);

    const action = makeGenerateDocumentAction(spec);
    const result = await action.execute(makeParams());

    expect(result.success).toBe(true);
    expect(result.message).toContain("Wedding Contract");
    expect(compileAndCreateDocument).toHaveBeenCalledWith(
      "template_1",
      expect.objectContaining({ workspaceId: "ws_1", memberId: "member_1", automationId: "workflow-wf_1-trigger-invoice.overdue-path-0", clientId: "client_1", eventId: "event_1" }),
      { permissions: ["documents.create"], role: "owner" },
    );
  });

  it("falls back to a 'system' memberId when the trigger has no acting member", async () => {
    vi.mocked(resolvePublishedTemplate).mockResolvedValue({ id: "template_1", name: "Wedding Contract" } as never);
    const compileAndCreateDocument = vi.fn().mockResolvedValue({ success: true, document: { id: "document_1" } });
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);

    const action = makeGenerateDocumentAction(spec);
    await action.execute(makeParams({ userId: null }));

    expect(compileAndCreateDocument).toHaveBeenCalledWith("template_1", expect.objectContaining({ memberId: "system" }), expect.anything());
  });

  it("surfaces compile validation issues in the failure message", async () => {
    vi.mocked(resolvePublishedTemplate).mockResolvedValue({ id: "template_1", name: "Wedding Contract" } as never);
    const compileAndCreateDocument = vi.fn().mockResolvedValue({ success: false, issues: [{ code: "missing_variable", target: "client_name", message: '"Client Name" is required.' }] });
    vi.mocked(getDocumentsManager).mockReturnValue({ compileAndCreateDocument } as never);

    const action = makeGenerateDocumentAction(spec);
    const result = await action.execute(makeParams());
    expect(result.success).toBe(false);
    expect(result.message).toContain("Client Name");
  });
});
