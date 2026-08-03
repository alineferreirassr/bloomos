import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { CreateProposalDraftInput } from "@/types/proposal";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

// Checkpoint 9 — `acceptProposalDraft`/`rejectProposalDraft` now dispatch a
// real Automation trigger on every call, which transitively registers
// every Automation Action, including the four "Generate X" actions that
// each import their own Skill wrapper (`generateDailyOperationsBrief`/
// `generateCRMAssistantBrief`/`generateFinanceAssistantBrief`), each of
// which calls `registerDefaultAIContextBuilders()` at module load —
// reaching `server-only`-guarded files this test never actually exercises.
// Mocked for the same reason every other AI entry-point test mocks this
// exact set: importing the real chain (not calling it) is enough to trip
// `server-only` in a jsdom test.
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { acceptProposalDraft } from "@/modules/ai/proposal/acceptProposalDraft";
import { rejectProposalDraft } from "@/modules/ai/proposal/rejectProposalDraft";
import { getLatestProposalForEvent } from "@/modules/ai/proposal/getLatestProposalForEvent";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { mockProposalsRepository, resetProposalsStore } from "@/lib/data/proposals/mockRepository";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.update"],
  workspaceDisplayName: "Amoré Bloom",
};

function makeInput(overrides: Partial<CreateProposalDraftInput> = {}): CreateProposalDraftInput {
  return {
    event_id: "event_1",
    client_id: "client_1",
    parent_proposal_id: null,
    executive_summary: "A summary.",
    event_overview: "An overview.",
    services_included: [],
    timeline_summary: "No schedule yet.",
    pricing_summary: { subtotal_minor: 0, currency: "USD" },
    payment_terms: [],
    recommendations: [],
    optional_add_ons: [],
    questions_for_client: [],
    ai_confidence: 80,
    missing_information: [],
    provider: "mock",
    model: "bloomos-mock-proposal-v1",
    prompt_version: "proposal-generator-v1",
    mock: true,
    generation_latency_ms: 10,
    generated_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => resetProposalsStore());
afterEach(() => vi.clearAllMocks());

describe("acceptProposalDraft", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await acceptProposalDraft("proposal_1");
    expect(result.success).toBe(false);
  });

  it("returns a generic access error without events.update", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: ["events.view"] });
    const result = await acceptProposalDraft("proposal_1");
    expect(result.success).toBe(false);
  });

  it("accepts a draft proposal, stamping the acting user as reviewer", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    if (!created.success) throw new Error("setup failed");

    const result = await acceptProposalDraft(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("accepted");
      expect(result.data.reviewed_by).toBe("user_1");
    }
  });

  it("surfaces the repository's own error for a nonexistent proposal, never a raw exception", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await acceptProposalDraft("missing");
    expect(result.success).toBe(false);
  });
});

describe("rejectProposalDraft", () => {
  it("rejects a draft proposal", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    if (!created.success) throw new Error("setup failed");

    const result = await rejectProposalDraft(created.data.id);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("rejected");
  });

  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await rejectProposalDraft("proposal_1");
    expect(result.success).toBe(false);
  });
});

describe("getLatestProposalForEvent", () => {
  it("returns null when no proposal exists yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getLatestProposalForEvent("event_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns the latest proposal for the Event", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    if (!created.success) throw new Error("setup failed");

    const result = await getLatestProposalForEvent("event_1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.id).toBe(created.data.id);
  });

  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getLatestProposalForEvent("event_1");
    expect(result.success).toBe(false);
  });
});
