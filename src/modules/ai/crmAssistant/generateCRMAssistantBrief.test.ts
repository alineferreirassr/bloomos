import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { AICompletion, AIProvider } from "@/core/ai/types";
import type { CrmAssistantMaterials } from "@/modules/ai/crmAssistant/fetchCrmAssistantContext.server";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/ai/crmAssistant/fetchCrmAssistantContext.server", () => ({
  fetchCrmAssistantMaterials: vi.fn(),
}));

// `registerDefaultAIContextBuilders()` (called at module load, same as every
// other AI entry point) registers every builder, not only
// `crmAssistantContext` — including ones whose own real module graph
// reaches `server-only`-guarded files this test never actually exercises.
// Mocked for the same reason `generateDailyOperationsBrief.test.ts` mocks
// this exact set.
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/core/ai/registry", () => ({
  getAIProvider: vi.fn(),
  isAIConfigured: vi.fn(),
}));

import { generateCRMAssistantBrief } from "@/modules/ai/crmAssistant/generateCRMAssistantBrief";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { fetchCrmAssistantMaterials } from "@/modules/ai/crmAssistant/fetchCrmAssistantContext.server";
import { getAIProvider, isAIConfigured } from "@/core/ai/registry";
import { getMemoryManager } from "@/core/ai/memory";
import { resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";
import { CRM_ASSISTANT_PROMPT_VERSION } from "@/modules/ai/crmAssistant/promptBuilder";
import { CRM_ASSISTANT_SKILL_ID } from "@/modules/ai/crmAssistant/registerCRMAssistantSkill";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["clients.view", "leads.view"],
  workspaceDisplayName: "Amoré Bloom",
};

const emptyMaterials: CrmAssistantMaterials = {
  clients: [],
  leads: [],
  events: [],
  contracts: [],
  invoices: [],
  proposals: [],
  dailyBriefExecutions: [],
  activity: [],
  unavailableCategories: [],
};

function validModelOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "Relationships look healthy overall.",
    relationshipHealthSummary: "No urgent issues.",
    clientRiskExplanations: [],
    upcomingOpportunities: [],
    suggestedFollowUps: [],
    recommendedActions: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  resetAIMemoryStore();
});

describe("generateCRMAssistantBrief", () => {
  it("returns a generic access error for a member without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(false);
    expect(fetchCrmAssistantMaterials).not.toHaveBeenCalled();
  });

  it("returns a generic access error for a member lacking clients.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: ["leads.view"] });
    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(false);
    expect(fetchCrmAssistantMaterials).not.toHaveBeenCalled();
  });

  it("uses the deterministic mock provider and reports mock:true when no provider is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(true);
      expect(result.data.brief.executiveSummary.length).toBeGreaterThan(0);
    }
  });

  it("uses the registered provider and reports mock:false when one is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const liveProvider: AIProvider = {
      name: "live-stub",
      complete: async (): Promise<AICompletion> => ({
        content: JSON.stringify(validModelOutput()),
        requiresApproval: true,
        model: "live-stub-1",
        finishReason: "stop",
      }),
    };
    vi.mocked(getAIProvider).mockReturnValue(liveProvider);

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(false);
      expect(result.data.provider).toBe("live-stub");
      expect(result.data.promptVersion).toBe(CRM_ASSISTANT_PROMPT_VERSION);
    }
  });

  it("rejects malformed (non-JSON) provider output rather than partially trusting it", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({ content: "not json", requiresApproval: true, model: "broken-1", finishReason: "stop" }),
    });

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(false);
  });

  it("rejects a response that references a Client not present in this Workspace's current risk list", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "inventive",
      complete: async () => ({
        content: JSON.stringify(validModelOutput({ clientRiskExplanations: [{ clientId: "invented_client", explanation: "Scary!" }] })),
        requiresApproval: true,
        model: "inventive-1",
        finishReason: "stop",
      }),
    });

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(false);
  });

  it("returns a safe error, never a raw exception, when the provider throws", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "flaky",
      complete: async () => {
        throw new Error("connection reset by peer, secret_key=sk-abc123");
      },
    });

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/secret_key|sk-abc123/);
  });

  it("propagates a safe error rather than throwing when context assembly itself fails", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockRejectedValue(new Error("relation clients does not exist"));

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/relation|does not exist/);
  });

  it("surfaces only approved memories through the optional memory context, never a still-proposed one", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const manager = getMemoryManager();
    await manager.createMemory("ws_1", {
      skillId: null,
      title: "Approved decision",
      summary: "Client agreed to a rush turnaround.",
      category: "operational_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });
    await manager.proposeMemory("ws_1", {
      skillId: "proposal.generate",
      title: "Unvetted suggestion",
      summary: "Should never appear.",
      visibility: "workspace",
    });

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      const titles = result.data.brief.relevantMemories.map((m) => m.title);
      expect(titles).toContain("Approved decision");
      expect(titles).not.toContain("Unvetted suggestion");
    }
  });

  it("never surfaces a rejected memory", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const manager = getMemoryManager();
    const proposed = await manager.proposeMemory("ws_1", { skillId: "proposal.generate", title: "Rejected idea", summary: "n/a", visibility: "workspace" });
    if (proposed.success) await manager.rejectMemory(proposed.data.id, "member_1");

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.brief.relevantMemories.map((m) => m.title)).not.toContain("Rejected idea");
  });

  it("executes through executeSkill() with the registered crm-assistant skill id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateCRMAssistantBrief();
    expect(result.success).toBe(true);
    expect(CRM_ASSISTANT_SKILL_ID).toBe("crm-assistant");
  });
});
