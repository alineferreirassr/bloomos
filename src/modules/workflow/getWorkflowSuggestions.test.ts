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

import { getWorkflowSuggestions } from "@/modules/workflow/getWorkflowSuggestions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerAutomation, resetAutomationRegistry } from "@/core/automation/registry";
import type { AutomationDefinition } from "@/types/automation";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["workspace.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function stubAutomation(overrides: Partial<AutomationDefinition> = {}): AutomationDefinition {
  return {
    id: "stub-automation",
    name: "Stub",
    description: "",
    category: "operations",
    version: "v1",
    status: "active",
    trigger: "proposal.rejected",
    conditions: [],
    actionIds: [],
    approvalPolicy: { kind: "never_required" },
    requiredPermissions: [],
    featureFlag: null,
    minimumRole: null,
    maxRetries: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  resetAutomationRegistry();
});

describe("getWorkflowSuggestions", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getWorkflowSuggestions();
    expect(result.success).toBe(false);
  });

  it("suggests a Trigger with a real built-in node but zero active listeners", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getWorkflowSuggestions();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((suggestion) => suggestion.triggerType === "proposal.rejected")).toBe(true);
    }
  });

  it("never suggests a Trigger that already has an active listener", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation({ trigger: "proposal.rejected", status: "active" }));
    const result = await getWorkflowSuggestions();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((suggestion) => suggestion.triggerType === "proposal.rejected")).toBe(false);
    }
  });

  it("a disabled Automation does not suppress the suggestion — it isn't an active listener", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    registerAutomation(stubAutomation({ trigger: "proposal.rejected", status: "disabled" }));
    const result = await getWorkflowSuggestions();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((suggestion) => suggestion.triggerType === "proposal.rejected")).toBe(true);
    }
  });

  it("never suggests a Trigger with no corresponding built-in node (e.g. event.updated)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getWorkflowSuggestions();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.some((suggestion) => suggestion.triggerType === "event.updated")).toBe(false);
    }
  });
});
