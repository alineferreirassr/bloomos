import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createWorkflow } from "@/modules/workflow/createWorkflow";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetWorkflowStore } from "@/lib/data/core/workflow/mockRepository";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
  resetWorkflowStore();
});

describe("createWorkflow", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createWorkflow("Test", "operations");
    expect(result.success).toBe(false);
  });

  it("Step 15: requires the elevated workspace.manage permission", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await createWorkflow("Test", "operations");
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWorkflow("   ", "operations");
    expect(result.success).toBe(false);
  });

  it("creates a draft Workflow with a Start node already placed", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWorkflow("Test Workflow", "operations");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.graph.nodes).toHaveLength(1);
      expect(result.data.graph.nodes[0].kind).toBe("start");
    }
  });

  it("pre-connects a suggested Trigger node when triggerNodeId is given", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWorkflow("Test Workflow", "finance", "trigger.invoice-overdue");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.graph.nodes.map((node) => node.kind).sort()).toEqual(["start", "trigger"]);
      expect(result.data.graph.edges).toHaveLength(1);
    }
  });

  it("falls back to a Start-only graph for an unknown triggerNodeId", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWorkflow("Test Workflow", "operations", "ghost.trigger");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.graph.nodes).toHaveLength(1);
  });

  it("Step 7: deep-clones a built-in Template's own graph onto the new Workflow when templateId is given", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWorkflow("From Template", "crm", null, "template.new-client-welcome");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.graph.nodes.length).toBeGreaterThan(1);
      expect(result.data.graph.nodes.some((node) => node.nodeTypeId === "trigger.client-created")).toBe(true);
      expect(result.data.metadata.description).toContain("CRM Assistant");
    }
  });

  it("mutating a Workflow created from a Template never mutates the Template's own registered graph", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const first = await createWorkflow("From Template A", "crm", null, "template.new-client-welcome");
    if (!first.success) throw new Error("setup failed");
    first.data.graph.nodes[0].label = "Mutated";

    const second = await createWorkflow("From Template B", "crm", null, "template.new-client-welcome");
    expect(second.success).toBe(true);
    if (second.success) expect(second.data.graph.nodes[0].label).not.toBe("Mutated");
  });

  it("falls back to the bare Start graph for an unknown templateId", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await createWorkflow("Test Workflow", "operations", null, "template.ghost");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.graph.nodes).toHaveLength(1);
  });
});
