import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { AICompletion, AIProvider } from "@/core/ai/types";
import type { DailyOperationsBriefMaterials } from "@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server", () => ({
  fetchDailyOperationsBriefMaterials: vi.fn(),
}));

// Freezes every "what time is it right now" default in the call graph
// (`buildDailyOperationsBriefContext`/`assembleDailyOperationsBrief`/
// `prepareCriticalFindings`, none of which receive an explicit `now` this
// far from the test) to one fixed instant — so "N day(s) overdue" and
// similar computed-from-today labels never drift with the real calendar
// day this suite happens to run on. See `core/time/clock.ts`'s own doc
// comment for why this is the seam to mock, not `new Date()` itself.
const FIXED_NOW = new Date("2026-07-26T12:00:00.000Z");
vi.mock("@/core/time/clock", () => ({ clockNow: vi.fn(() => FIXED_NOW) }));

// `registerDefaultAIContextBuilders()` (called at module load, same as every
// other AI entry point) registers every builder, not only `dailyBriefContext`
// — including ones whose own real module graph reaches `server-only`-guarded
// files this test never actually exercises. Mocked for the same reason
// `generateProposalDraft.test.ts` mocks this exact set: importing the real
// chain (not calling it) is enough to trip `server-only` in a jsdom test.
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

// Same reasoning as `generateEventOperationsBrief.test.ts`: the Skill
// Resolver (`core/ai/skills/resolver.ts`) imports `getAIProvider`/
// `isAIConfigured` from `@/core/ai/registry` directly (not the `@/core/ai`
// barrel, to avoid a circular import back through it) — this must be the
// mock target for provider control to actually take effect.
vi.mock("@/core/ai/registry", () => ({
  getAIProvider: vi.fn(),
  isAIConfigured: vi.fn(),
}));

import { generateDailyOperationsBrief } from "@/modules/ai/dailyBrief/generateDailyOperationsBrief";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { fetchDailyOperationsBriefMaterials } from "@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server";
import { getAIProvider, isAIConfigured } from "@/core/ai/registry";
import { resetDailyBriefExecutionsStore, mockDailyBriefExecutionsRepository } from "@/lib/data/dailyBrief/mockRepository";
import { DAILY_OPERATIONS_BRIEF_PROMPT_VERSION } from "@/modules/ai/dailyBrief/promptBuilder";
import { resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";
import { getMemoryManager } from "@/core/ai/memory";
import { DAILY_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/dailyBrief/registerDailyOperationsBriefSkill";
import { makeInvoice } from "@/modules/finance/testUtils";
import { makeContract } from "@/modules/contracts/testUtils";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.update"],
  workspaceDisplayName: "Amoré Bloom",
};

const emptyMaterials: DailyOperationsBriefMaterials = {
  eventRecords: [],
  lateInvoices: [],
  unsignedContracts: [],
  highPriorityClients: [],
  unreadNotificationCount: 0,
  recentActivity: [],
  unavailableCategories: [],
};

function validModelOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "Everything is on track today.",
    todaysPriorities: ["Continue routine monitoring."],
    riskExplanations: [],
    recommendations: [],
    suggestedActions: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  resetDailyBriefExecutionsStore();
  resetAIMemoryStore();
});

describe("generateDailyOperationsBrief", () => {
  it("returns a generic access error for a member without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
    expect(fetchDailyOperationsBriefMaterials).not.toHaveBeenCalled();
  });

  it("returns a generic access error for a member lacking events.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
    expect(fetchDailyOperationsBriefMaterials).not.toHaveBeenCalled();
  });

  it("uses the deterministic mock provider and reports mock:true when no provider is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(true);
      expect(result.data.brief.executiveSummary.length).toBeGreaterThan(0);
    }
  });

  it("uses the registered provider and reports mock:false when one is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
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

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(false);
      expect(result.data.provider).toBe("live-stub");
      expect(result.data.promptVersion).toBe(DAILY_OPERATIONS_BRIEF_PROMPT_VERSION);
    }
  });

  it("rejects malformed (non-JSON) provider output rather than partially trusting it", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({ content: "not json", requiresApproval: true, model: "broken-1", finishReason: "stop" }),
    });

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
  });

  it("rejects a response that references an Event not present in this Workspace's current data", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "inventive",
      complete: async () => ({
        content: JSON.stringify(validModelOutput({ riskExplanations: [{ eventId: "invented_event", explanation: "Scary!" }] })),
        requiresApproval: true,
        model: "inventive-1",
        finishReason: "stop",
      }),
    });

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
  });

  it("returns a safe error, never a raw exception, when the provider throws", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "flaky",
      complete: async () => {
        throw new Error("connection reset by peer, secret_key=sk-abc123");
      },
    });

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/secret_key|sk-abc123/);
  });

  it("propagates a safe error rather than throwing when context assembly itself fails", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockRejectedValue(new Error("relation events does not exist"));

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/relation|does not exist/);
  });

  it("records a successful execution to history with provider/latency/promptVersion, never the brief's own content", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    await generateDailyOperationsBrief();

    const executions = await mockDailyBriefExecutionsRepository.getRecentExecutions("ws_1", 5);
    expect(executions).toHaveLength(1);
    expect(executions[0].status).toBe("success");
    expect(executions[0].prompt_version).toBe(DAILY_OPERATIONS_BRIEF_PROMPT_VERSION);
    expect(executions[0]).not.toHaveProperty("executiveSummary");
    expect(executions[0]).not.toHaveProperty("prompt");
  });

  it("records a failed execution to history with status:failure", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({ content: "not json", requiresApproval: true, model: "broken-1", finishReason: "stop" }),
    });

    await generateDailyOperationsBrief();

    const executions = await mockDailyBriefExecutionsRepository.getRecentExecutions("ws_1", 5);
    expect(executions).toHaveLength(1);
    expect(executions[0].status).toBe("failure");
  });

  it("has no briefComparison on this Workspace's very first Daily Brief (no prior snapshot in memory)", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.brief.briefComparison).toBeNull();
  });

  it("writes an auto-approved historical_knowledge memory snapshot after a successful generation", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue({
      ...emptyMaterials,
      lateInvoices: [makeInvoice({ id: "inv_1", invoice_number: "INV-1", due_date: "2026-07-01", balance_minor: 5000 })],
    });
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(true);

    const memories = await getMemoryManager().filterMemories("ws_1", { category: "historical_knowledge", skillId: DAILY_OPERATIONS_BRIEF_SKILL_ID });
    expect(memories).toHaveLength(1);
    expect(memories[0].source).toBe("system");
    expect(memories[0].approval_status).toBe("approved");
    expect(JSON.parse(memories[0].summary)).toEqual([{ key: "late-payment:inv_1", label: "Invoice INV-1 overdue by 25 day(s)" }]);
  });

  it("never records a memory snapshot for a failed generation", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue(emptyMaterials);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({ content: "not json", requiresApproval: true, model: "broken-1", finishReason: "stop" }),
    });

    await generateDailyOperationsBrief();

    const memories = await getMemoryManager().filterMemories("ws_1", { category: "historical_knowledge", skillId: DAILY_OPERATIONS_BRIEF_SKILL_ID });
    expect(memories).toHaveLength(0);
  });

  it("on a second generation, diffs against the previous snapshot to surface new/resolved/persistent issues", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    // First run: one late invoice, one unsigned contract.
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue({
      ...emptyMaterials,
      lateInvoices: [makeInvoice({ id: "inv_1", invoice_number: "INV-1", due_date: "2026-07-01", balance_minor: 5000 })],
      unsignedContracts: [makeContract({ id: "contract_1", contract_number: "C-1", event_id: null, signature_status: "unsigned" })],
    });
    const first = await generateDailyOperationsBrief();
    expect(first.success).toBe(true);
    if (first.success) expect(first.data.brief.briefComparison).toBeNull();

    // Second run: the invoice is now paid off (resolved), the contract is
    // still unsigned (persistent), and a new late invoice has appeared.
    vi.mocked(fetchDailyOperationsBriefMaterials).mockResolvedValue({
      ...emptyMaterials,
      lateInvoices: [makeInvoice({ id: "inv_2", invoice_number: "INV-2", due_date: "2026-07-01", balance_minor: 3000 })],
      unsignedContracts: [makeContract({ id: "contract_1", contract_number: "C-1", event_id: null, signature_status: "unsigned" })],
    });
    const second = await generateDailyOperationsBrief();
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.brief.briefComparison).toEqual({
        newIssues: ["Invoice INV-2 overdue by 25 day(s)"],
        resolvedIssues: ["Invoice INV-1 overdue by 25 day(s)"],
        persistentRisks: ["Contract C-1 unsigned"],
      });
    }
  });
});
