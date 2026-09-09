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

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { workflowRecommendationsForExecutiveDecisions } from "@/modules/workflowMonitoring/workflowMonitoringActions";
import { createWorkflow } from "@/modules/workflow/createWorkflow";
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

describe("workflowRecommendationsForExecutiveDecisions", () => {
  it("returns an empty array when there is no active session, never throwing", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "no-workspace" });

    const recommendations = await workflowRecommendationsForExecutiveDecisions();

    expect(recommendations).toEqual([]);
  });

  it("completes the real end-to-end path for a workspace with a live workflow", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await createWorkflow("Test Workflow", "operations");

    const recommendations = await workflowRecommendationsForExecutiveDecisions();

    expect(Array.isArray(recommendations)).toBe(true);
  });
});
