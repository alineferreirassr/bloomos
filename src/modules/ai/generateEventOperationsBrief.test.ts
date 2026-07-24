import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEvent, makeChecklistItem } from "@/modules/events/testUtils";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { AICompletion, AIProvider } from "@/core/ai/types";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/ai/fetchEventContext.server", () => ({
  fetchEventContextRecord: vi.fn(),
}));

vi.mock("@/core/ai", () => ({
  getAIProvider: vi.fn(),
  isAIConfigured: vi.fn(),
}));

import { generateEventOperationsBrief } from "@/modules/ai/generateEventOperationsBrief";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";
import { getAIProvider, isAIConfigured } from "@/core/ai";
import { EVENT_OPERATIONS_BRIEF_PROMPT_VERSION } from "@/modules/ai/promptBuilder";
import { EVENT_OPERATIONS_BRIEF_CONTEXT_VERSION } from "@/modules/ai/contextBuilder";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.update"],
  workspaceDisplayName: "Amoré Bloom",
};

const record = { event: makeEvent({ id: "event_1", updated_at: "2026-07-20T00:00:00.000Z" }), client: null, checklist: [], schedule: [] };

function validModelOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "Live summary",
    healthExplanation: "Health is ready at 100/100.",
    riskExplanations: [],
    recommendedActions: [{ label: "Do the thing", reason: "Because the data says so.", actionTargetType: null }],
    preparationNotes: null,
    internalNotes: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("generateEventOperationsBrief", () => {
  it("returns a generic access error for a member without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(false);
    expect(fetchEventContextRecord).not.toHaveBeenCalled();
  });

  it("returns a generic access error for a member lacking events.view — never mutation-implying", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(false);
    expect(fetchEventContextRecord).not.toHaveBeenCalled();
  });

  it("returns a generic access error, not a raw not-found error, when the Event doesn't exist or isn't in this Workspace", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(null);
    const result = await generateEventOperationsBrief("event_missing");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toMatch(/database|supabase|sql/i);
    }
  });

  it("uses the deterministic mock provider and reports mock:true when no provider is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(true);
      expect(result.data.brief.executiveSummary.length).toBeGreaterThan(0);
      expect(result.data.brief.recommendedActions.length).toBeGreaterThan(0);
    }
  });

  it("uses the registered provider and reports mock:false when one is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
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

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(false);
      expect(result.data.model).toBe("live-stub-1");
      expect(result.data.provider).toBe("live-stub");
      expect(result.data.brief.executiveSummary).toBe("Live summary");
    }
  });

  it("stamps versioning metadata — promptVersion, contextVersion, and the source Event's updated_at", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.promptVersion).toBe(EVENT_OPERATIONS_BRIEF_PROMPT_VERSION);
      expect(result.data.contextVersion).toBe(EVENT_OPERATIONS_BRIEF_CONTEXT_VERSION);
      expect(result.data.sourceEventUpdatedAt).toBe("2026-07-20T00:00:00.000Z");
    }
  });

  it("discards a risk explanation whose kind does not match any risk BloomOS actually detected", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "inventive",
      complete: async () => ({
        content: JSON.stringify(
          validModelOutput({ riskExplanations: [{ kind: "invented_risk_the_model_made_up", explanation: "Scary!" }] }),
        ),
        requiresApproval: true,
        model: "inventive-1",
        finishReason: "stop",
      }),
    });

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brief.riskExplanations.some((r) => r.risk.kind === "invented_risk_the_model_made_up")).toBe(false);
    }
  });

  it("only ever resolves an actionTarget to one of the three fixed, hardcoded routes, never a model-supplied URL", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "checklist-linker",
      complete: async () => ({
        content: JSON.stringify(
          validModelOutput({
            recommendedActions: [{ label: "Confirm florist", reason: "Two overdue items depend on it.", actionTargetType: "checklist" }],
          }),
        ),
        requiresApproval: true,
        model: "checklist-linker-1",
        finishReason: "stop",
      }),
    });

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brief.recommendedActions[0].actionTarget).toEqual({
        type: "checklist",
        href: "/events/event_1/checklist",
        label: "Open Checklist",
      });
    }
  });

  it("real, currently-detected risks are always explained, even if the model omits one — falling back to the deterministic evidence", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const recordWithOwnerGap = { ...record, event: makeEvent({ id: "event_1", assigned_owner: null, updated_at: "2026-07-20T00:00:00.000Z" }) };
    vi.mocked(fetchEventContextRecord).mockResolvedValue(recordWithOwnerGap);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "incomplete",
      complete: async () => ({
        content: JSON.stringify(validModelOutput({ riskExplanations: [] })),
        requiresApproval: true,
        model: "incomplete-1",
        finishReason: "stop",
      }),
    });

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brief.riskExplanations.some((r) => r.risk.kind === "missing_owner")).toBe(true);
    }
  });

  it("returns a safe error, never a raw exception, when the provider throws", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "flaky",
      complete: async () => {
        throw new Error("connection reset by peer, secret_key=sk-abc123");
      },
    });

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toMatch(/secret_key|sk-abc123/);
    }
  });

  it("rejects malformed (non-JSON) provider output rather than partially trusting it", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({
        content: "Sure! Here's a lovely summary of your event, not JSON at all.",
        requiresApproval: true,
        model: "broken-1",
        finishReason: "stop",
      }),
    });

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(false);
  });

  it("rejects structurally invalid JSON output (schema mismatch) rather than rendering it", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "wrong-shape",
      complete: async () => ({
        content: JSON.stringify({ notTheRightField: true }),
        requiresApproval: true,
        model: "wrong-shape-1",
        finishReason: "stop",
      }),
    });

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(false);
  });

  it("rejects a recommendation with no reason, even if the rest of the shape is valid", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "no-reason",
      complete: async () => ({
        content: JSON.stringify(
          validModelOutput({ recommendedActions: [{ label: "Do a thing", reason: "", actionTargetType: null }] }),
        ),
        requiresApproval: true,
        model: "no-reason-1",
        finishReason: "stop",
      }),
    });

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(false);
  });

  it("treats an explicit provider error finishReason as a failure without rendering partial content", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "refusing",
      complete: async () => ({ content: "", requiresApproval: true, model: "refusing-1", finishReason: "error" }),
    });

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(false);
  });

  it("propagates a safe error rather than throwing when the context fetch itself fails", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockRejectedValue(new Error("relation events does not exist"));

    const result = await generateEventOperationsBrief("event_1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toMatch(/relation|does not exist/);
    }
  });
});

// Only imported for the fixture above (needs a distinct name to avoid shadowing `record`).
void makeChecklistItem;
