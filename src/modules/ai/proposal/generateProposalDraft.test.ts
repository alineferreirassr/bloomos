import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeEvent } from "@/modules/events/testUtils";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { AICompletion, AIProvider } from "@/core/ai/types";
import type { Client } from "@/types/client";
import type { EventService } from "@/types/eventService";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/modules/ai/fetchEventContext.server", () => ({
  fetchEventContextRecord: vi.fn(),
}));
vi.mock("@/lib/data/mock/clientsStore", () => ({
  readClients: vi.fn(),
}));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({
  readEventServices: vi.fn(),
}));
vi.mock("@/lib/data/mock/contractsStore", () => ({
  readContracts: vi.fn(),
}));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({
  getNotesByOwner: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("@/core/ai/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/ai/registry")>();
  return { ...actual, getAIProvider: vi.fn(), isAIConfigured: vi.fn() };
});

import { generateProposalDraft } from "@/modules/ai/proposal/generateProposalDraft";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";
import { readClients } from "@/lib/data/mock/clientsStore";
import { readEventServices } from "@/lib/data/mock/eventServicesStore";
import { readContracts } from "@/lib/data/mock/contractsStore";
import { getNotesByOwner } from "@/lib/data/mock/notesTimelineShared";
import { getAIProvider, isAIConfigured } from "@/core/ai/registry";
import { resetProposalsStore } from "@/lib/data/proposals/mockRepository";
import { getMemoryManager } from "@/core/ai/memory";
import { resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";
import { PROPOSAL_PROMPT_VERSION } from "@/modules/ai/proposal/promptBuilder";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.update"],
  workspaceDisplayName: "Amoré Bloom",
};

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client_test",
    workspace_id: "ws_1",
    originating_lead_id: null,
    first_name: "Jamie",
    last_name: "Rivera",
    email: "jamie@example.com",
    phone: null,
    instagram: null,
    preferred_contact_method: null,
    partner_name: null,
    relationship_status: "Dating",
    important_dates: [],
    address: null,
    city: null,
    state: null,
    zip_code: null,
    source: null,
    tags: [],
    internal_status: "active",
    is_returning: false,
    how_they_met: null,
    first_date: null,
    relationship_anniversary: null,
    engagement_date: null,
    wedding_date: null,
    favorite_colors: null,
    favorite_flowers: null,
    favorite_music: null,
    favorite_food: null,
    favorite_drinks: null,
    favorite_restaurants: null,
    preferred_style: null,
    disliked_elements: null,
    allergies: null,
    accessibility_needs: null,
    dietary_restrictions: null,
    preferred_communication_time: null,
    do_not_call: false,
    surprise_event_confidentiality: false,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    is_vip: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    pending_recovery: null,
    ...overrides,
  };
}

function makeEventService(overrides: Partial<EventService> = {}): EventService {
  return {
    id: "es_1",
    workspace_id: "ws_1",
    event_id: "event_1",
    service_id: "svc_1",
    service_version_id: "sv_1",
    name: "Photography",
    name_template_value: "Photography",
    price_minor: 50000,
    price_template_value: 50000,
    currency: "USD",
    selected_add_on_ids: [],
    status: "confirmed",
    assigned_at: "2026-01-01T00:00:00.000Z",
    assigned_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function validModelOutput(overrides: Record<string, unknown> = {}) {
  return {
    executiveSummary: "A proposal for Jamie Rivera's beachfront event.",
    eventOverview: "Beachfront event overview.",
    servicesIncluded: [{ eventServiceId: "es_1", note: null }],
    timelineSummary: "No schedule yet.",
    paymentTerms: [{ label: "Full balance", amountMinor: 50000, dueDate: null, description: null }],
    recommendations: [],
    optionalAddOns: [],
    questionsForClient: [],
    missingInformation: [],
    suggestedMemory: null,
    ...overrides,
  };
}

function setupHappyPathFixtures() {
  const record = { event: makeEvent({ id: "event_1", client_id: "client_test", updated_at: "2026-07-20T00:00:00.000Z" }), client: makeClient(), checklist: [], schedule: [] };
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(fetchEventContextRecord).mockResolvedValue(record);
  vi.mocked(readClients).mockReturnValue([makeClient()]);
  vi.mocked(readEventServices).mockReturnValue([makeEventService()]);
  vi.mocked(readContracts).mockReturnValue([]);
  vi.mocked(getNotesByOwner).mockResolvedValue([]);
}

beforeEach(() => {
  resetProposalsStore();
  resetAIMemoryStore();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("generateProposalDraft", () => {
  it("returns a generic access error for a member without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(false);
    expect(fetchEventContextRecord).not.toHaveBeenCalled();
  });

  it("returns a generic access error for a member lacking events.update", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: ["events.view"] });
    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(false);
    expect(fetchEventContextRecord).not.toHaveBeenCalled();
  });

  it("returns a generic access error, not a raw error, when the Event doesn't exist", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockResolvedValue(null);
    const result = await generateProposalDraft("event_missing");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/database|supabase|sql/i);
  });

  it("uses the deterministic mock provider and reports mock:true when no provider is configured", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(true);
      expect(result.data.executive_summary.length).toBeGreaterThan(0);
      expect(result.data.status).toBe("draft");
      expect(result.data.version).toBe(1);
    }
  });

  it("uses the registered provider and resolves servicesIncluded to the real assigned service", async () => {
    setupHappyPathFixtures();
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

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(false);
      expect(result.data.provider).toBe("live-stub");
      expect(result.data.model).toBe("live-stub-1");
      expect(result.data.prompt_version).toBe(PROPOSAL_PROMPT_VERSION);
      expect(result.data.services_included).toEqual([
        { event_service_id: "es_1", label: "Photography", description: null, price_minor: 50000, currency: "USD", is_optional_add_on: false },
      ]);
    }
  });

  it("rejects a draft that references a service not actually assigned to the Event (hallucinated service)", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "inventive",
      complete: async () => ({
        content: JSON.stringify(validModelOutput({ servicesIncluded: [{ eventServiceId: "invented_service", note: null }] })),
        requiresApproval: true,
        model: "inventive-1",
        finishReason: "stop",
      }),
    });

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(false);
  });

  it("rejects a draft whose payment schedule doesn't sum to the real pricing total (hallucinated pricing)", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "overcharging",
      complete: async () => ({
        content: JSON.stringify(validModelOutput({ paymentTerms: [{ label: "Full balance", amountMinor: 999999, dueDate: null, description: null }] })),
        requiresApproval: true,
        model: "overcharging-1",
        finishReason: "stop",
      }),
    });

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(false);
  });

  it("rejects malformed (non-JSON) provider output", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({ content: "not json", requiresApproval: true, model: "broken-1", finishReason: "stop" }),
    });

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(false);
  });

  it("returns a safe error, never a raw exception, when the provider throws", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "flaky",
      complete: async () => {
        throw new Error("connection reset by peer, secret_key=sk-abc123");
      },
    });

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/secret_key|sk-abc123/);
  });

  it("persists the generated draft — a subsequent regeneration continues the Event's version chain", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const first = await generateProposalDraft("event_1");
    expect(first.success).toBe(true);
    if (!first.success) return;

    const second = await generateProposalDraft("event_1", first.data.id);
    expect(second.success).toBe(true);
    if (second.success) {
      expect(second.data.version).toBe(2);
      expect(second.data.parent_proposal_id).toBe(first.data.id);
    }
  });

  it("proposes a memory (never auto-approved) when the model suggests one", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "memory-suggesting",
      complete: async () => ({
        content: JSON.stringify(validModelOutput({ suggestedMemory: { scope: "workspace", content: "Client prefers a formal tone." } })),
        requiresApproval: true,
        model: "memory-suggesting-1",
        finishReason: "stop",
      }),
    });

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(true);

    const pending = await getMemoryManager().getPendingProposals("ws_1");
    expect(pending.some((entry) => entry.summary === "Client prefers a formal tone." && entry.approval_status === "proposed")).toBe(true);
  });

  it("never proposes a memory when the model returns null", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    await generateProposalDraft("event_1");
    const pending = await getMemoryManager().getPendingProposals("ws_1");
    expect(pending).toEqual([]);
  });

  it("surfaces approved memories relevant to this Event or Client, never a still-pending proposal", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const eventMemory = await getMemoryManager().createMemory("ws_1", {
      skillId: "proposal.generate",
      entityType: "event",
      entityId: "event_1",
      title: "Prior venue change",
      summary: "The venue was changed once already due to a weather concern.",
      category: "operational_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 90,
      source: "human",
    });
    const clientMemory = await getMemoryManager().createMemory("ws_1", {
      skillId: "proposal.generate",
      entityType: "client",
      entityId: "client_test",
      title: "Client prefers email",
      summary: "This Client prefers email over phone for all communication.",
      category: "workspace_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 90,
      source: "human",
    });
    const unvetted = await getMemoryManager().proposeMemory("ws_1", {
      skillId: "proposal.generate",
      entityType: "event",
      entityId: "event_1",
      title: "Unvetted suggestion",
      summary: "This has not been approved by a human yet.",
      visibility: "workspace",
    });
    if (!eventMemory.success || !clientMemory.success || !unvetted.success) throw new Error("setup failed");

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(true);
    if (result.success) {
      const ids = result.relevantMemories.map((memory) => memory.id);
      expect(ids).toEqual(expect.arrayContaining([eventMemory.data.id, clientMemory.data.id]));
      expect(ids).not.toContain(unvetted.data.id);
      expect(result.relevantMemories.every((memory) => memory.approval_status === "approved")).toBe(true);
    }
  });

  it("never modifies proposal content based on memory — relevantMemories is informational only", async () => {
    setupHappyPathFixtures();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const withoutMemory = await generateProposalDraft("event_1");

    await getMemoryManager().createMemory("ws_1", {
      skillId: "proposal.generate",
      entityType: "event",
      entityId: "event_1",
      title: "Some historical fact",
      summary: "Some historical fact that should never change generation.",
      category: "operational_knowledge",
      importance: "high",
      visibility: "workspace",
      confidence: 90,
      source: "human",
    });
    const withMemory = await generateProposalDraft("event_1", withoutMemory.success ? withoutMemory.data.id : null);

    expect(withoutMemory.success).toBe(true);
    expect(withMemory.success).toBe(true);
    if (withoutMemory.success && withMemory.success) {
      expect(withMemory.data.executive_summary).toBe(withoutMemory.data.executive_summary);
      expect(withMemory.relevantMemories.length).toBeGreaterThan(0);
    }
  });

  it("propagates a safe error rather than throwing when the context fetch itself fails", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchEventContextRecord).mockRejectedValue(new Error("relation events does not exist"));

    const result = await generateProposalDraft("event_1");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/relation|does not exist/);
  });
});
