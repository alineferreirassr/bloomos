import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { AICompletion, AIProvider } from "@/core/ai/types";
import type { FinanceAssistantMaterials } from "@/modules/ai/financeAssistant/fetchFinanceAssistantContext.server";
import type { CrmAssistantMaterials } from "@/modules/ai/crmAssistant/fetchCrmAssistantContext.server";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/ai/financeAssistant/fetchFinanceAssistantContext.server", () => ({
  fetchFinanceAssistantMaterials: vi.fn(),
}));

// Same reasoning as `generateCRMAssistantBrief.test.ts`: `registerDefaultAIContextBuilders()`
// (called at module load) registers every builder, including ones whose own
// real module graph reaches `server-only`-guarded files this test never
// actually exercises.
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

// CRM Assistant's own materials fetch is also transitively registered
// (`crmAssistantContext` is Finance Assistant's own optional section) — mock
// it too so its real fetch pipeline never runs in this test.
vi.mock("@/modules/ai/crmAssistant/fetchCrmAssistantContext.server", () => ({
  fetchCrmAssistantMaterials: vi.fn(),
}));

vi.mock("@/core/ai/registry", () => ({
  getAIProvider: vi.fn(),
  isAIConfigured: vi.fn(),
}));

import { generateFinanceAssistantBrief } from "@/modules/ai/financeAssistant/generateFinanceAssistantBrief";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { fetchFinanceAssistantMaterials } from "@/modules/ai/financeAssistant/fetchFinanceAssistantContext.server";
import { fetchCrmAssistantMaterials } from "@/modules/ai/crmAssistant/fetchCrmAssistantContext.server";
import { getAIProvider, isAIConfigured } from "@/core/ai/registry";
import { getMemoryManager } from "@/core/ai/memory";
import { resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";
import { FINANCE_ASSISTANT_PROMPT_VERSION } from "@/modules/ai/financeAssistant/promptBuilder";
import { FINANCE_ASSISTANT_SKILL_ID } from "@/modules/ai/financeAssistant/registerFinanceAssistantSkill";
import { makeClient } from "@/modules/clients/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["finance.view", "clients.view"],
  workspaceDisplayName: "Amoré Bloom",
};

const emptyMaterials: FinanceAssistantMaterials = {
  contracts: [],
  invoices: [],
  payments: [],
  expenses: [],
  events: [],
  proposals: [],
  dailyBriefExecutions: [],
  activity: [],
  unavailableCategories: [],
};

function validModelOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "Revenue looks healthy this month.",
    revenueOverviewSummary: "Strong collection rate.",
    cashFlowSummary: "No cash flow concerns.",
    financialRiskExplanations: [],
    revenueOpportunities: [],
    recommendations: [],
    ...overrides,
  };
}

const emptyCrmMaterials: CrmAssistantMaterials = {
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

beforeEach(() => {
  vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue(emptyCrmMaterials);
});

afterEach(() => {
  vi.clearAllMocks();
  resetAIMemoryStore();
});

describe("generateFinanceAssistantBrief", () => {
  it("returns a generic access error for a member without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(false);
    expect(fetchFinanceAssistantMaterials).not.toHaveBeenCalled();
  });

  it("returns a generic access error for a member lacking finance.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: ["clients.view"] });
    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(false);
    expect(fetchFinanceAssistantMaterials).not.toHaveBeenCalled();
  });

  it("uses the deterministic mock provider and reports mock:true when no provider is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(true);
      expect(result.data.brief.executiveSummary.length).toBeGreaterThan(0);
    }
  });

  it("uses the registered provider and reports mock:false when one is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
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

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(false);
      expect(result.data.provider).toBe("live-stub");
      expect(result.data.promptVersion).toBe(FINANCE_ASSISTANT_PROMPT_VERSION);
    }
  });

  it("rejects malformed (non-JSON) provider output rather than partially trusting it", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({ content: "not json", requiresApproval: true, model: "broken-1", finishReason: "stop" }),
    });

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(false);
  });

  it("rejects a response that references a financial risk not present in this Workspace's current data", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "inventive",
      complete: async () => ({
        content: JSON.stringify(validModelOutput({ financialRiskExplanations: [{ riskId: "invoice:invented", explanation: "Scary!" }] })),
        requiresApproval: true,
        model: "inventive-1",
        finishReason: "stop",
      }),
    });

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(false);
  });

  it("returns a safe error, never a raw exception, when the provider throws", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "flaky",
      complete: async () => {
        throw new Error("connection reset by peer, secret_key=sk-abc123");
      },
    });

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/secret_key|sk-abc123/);
  });

  it("propagates a safe error rather than throwing when context assembly itself fails", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockRejectedValue(new Error("relation invoices does not exist"));

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/relation|does not exist/);
  });

  it("surfaces only approved memories through the optional memory context, never a still-proposed one", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const manager = getMemoryManager();
    await manager.createMemory("ws_1", {
      skillId: null,
      title: "Approved financial decision",
      summary: "Client agreed to a payment plan.",
      category: "operational_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });
    await manager.proposeMemory("ws_1", {
      skillId: "finance-assistant",
      title: "Unvetted suggestion",
      summary: "Should never appear.",
      visibility: "workspace",
    });

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      const titles = result.data.brief.relevantMemories.map((m) => m.title);
      expect(titles).toContain("Approved financial decision");
      expect(titles).not.toContain("Unvetted suggestion");
    }
  });

  it("never surfaces a rejected memory", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const manager = getMemoryManager();
    const proposed = await manager.proposeMemory("ws_1", { skillId: "finance-assistant", title: "Rejected idea", summary: "n/a", visibility: "workspace" });
    if (proposed.success) await manager.rejectMemory(proposed.data.id, "member_1");

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.brief.relevantMemories.map((m) => m.title)).not.toContain("Rejected idea");
  });

  it("surfaces real CRM recommendations from the optional crmAssistantContext section (Step 2)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);
    vi.mocked(fetchCrmAssistantMaterials).mockResolvedValue({
      ...emptyCrmMaterials,
      clients: [makeClient({ id: "c1", first_name: "Jane", last_name: "Doe" })],
      contracts: [makeContract({ id: "ct1", client_id: "c1", contract_number: "C-1", signature_status: "unsigned" })],
    });

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brief.crmRecommendations).toHaveLength(1);
      expect(result.data.brief.crmRecommendations[0]).toEqual({ clientId: "c1", name: "Jane Doe", reasons: ["Unsigned contract C-1"] });
    }
  });

  it("executes through executeSkill() with the registered finance-assistant skill id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchFinanceAssistantMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateFinanceAssistantBrief();
    expect(result.success).toBe(true);
    expect(FINANCE_ASSISTANT_SKILL_ID).toBe("finance-assistant");
  });
});
