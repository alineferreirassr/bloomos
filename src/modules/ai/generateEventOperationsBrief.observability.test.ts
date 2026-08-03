import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeEvent } from "@/modules/events/testUtils";
import { setLogger, consoleLogger } from "@/core/observability/logger";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { AICompletion, AIProvider } from "@/core/ai/types";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/ai/fetchEventContext.server", () => ({
  fetchEventContextRecord: vi.fn(),
}));

vi.mock("@/core/ai/registry", () => ({
  getAIProvider: vi.fn(),
  isAIConfigured: vi.fn(),
}));

import { generateEventOperationsBrief } from "@/modules/ai/generateEventOperationsBrief";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";
import { getAIProvider, isAIConfigured } from "@/core/ai/registry";
import { EVENT_OPERATIONS_BRIEF_PROMPT_VERSION } from "@/modules/ai/promptBuilder";

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

type LogFn = (message: string, context?: Record<string, unknown>) => void;
let logSpy: ReturnType<typeof vi.fn<LogFn>>;

beforeEach(() => {
  logSpy = vi.fn<LogFn>();
  setLogger({ debug: logSpy, info: logSpy, warn: logSpy, error: logSpy });
});

afterEach(() => {
  vi.clearAllMocks();
  setLogger(consoleLogger);
});

describe("generateEventOperationsBrief observability", () => {
  it("logs useCaseId, promptVersion, and a positive estimatedTokens — never the prompt text or context facts", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    await generateEventOperationsBrief("event_1");

    const invokedCall = logSpy.mock.calls.find(([message]) => message === "AI use case invoked");
    expect(invokedCall).toBeDefined();
    const [, context] = invokedCall as [string, Record<string, unknown>];
    expect(context).toMatchObject({ useCaseId: "event-operations-brief", promptVersion: EVENT_OPERATIONS_BRIEF_PROMPT_VERSION });
    expect(context.estimatedTokens).toBeGreaterThan(0);

    for (const call of logSpy.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain("Beachfront"); // no Event title or other prompt content
      expect(serialized).not.toContain("BLOOM_CONTEXT");
    }
  });

  it("logs a success validation outcome without echoing the model's raw content", async () => {
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

    await generateEventOperationsBrief("event_1");

    expect(logSpy).toHaveBeenCalledWith("AI use case output validated", { useCaseId: "event-operations-brief" });
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("Live summary");
    }
  });

  it("logs a failed-validation category without leaking the malformed content itself", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({
        content: "not json at all, definitely-unique-marker",
        requiresApproval: true,
        model: "broken-1",
        finishReason: "stop",
      }),
    });

    await generateEventOperationsBrief("event_1");

    expect(logSpy).toHaveBeenCalledWith("AI use case output failed validation", {
      useCaseId: "event-operations-brief",
      category: "malformed_output",
    });
    for (const call of logSpy.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("definitely-unique-marker");
    }
  });
});
