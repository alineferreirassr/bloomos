import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { BloomAIOverviewView } from "@/modules/ai/components/BloomAIOverviewView";
import type { BloomAIOverviewData } from "@/modules/ai/getBloomAIOverview";
import type { GetBloomAIOverviewResult } from "@/modules/ai/getBloomAIOverview";
import type { SkillMetadata } from "@/core/ai/skills/types";
import type { ProposalDraft } from "@/types/proposal";
import type { AIMemorySummary, AIMemoryEntry } from "@/types/aiMemory";
import { AI_MEMORY_CATEGORIES } from "@/types/aiMemory";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

vi.mock("@/modules/ai/getBloomAIOverview", () => ({ getBloomAIOverview: vi.fn() }));
// Same reasoning as the `getBloomAIOverview` mock above — the real
// `browseAIMemory.ts` is a "use server" action whose module graph reaches
// `resolveMemberSessionSnapshot`'s own `server-only` guard, which trips
// immediately in this Client Component test's plain jsdom import (there's
// no RSC boundary here to make the pragma a no-op).
vi.mock("@/modules/ai/memory/browseAIMemory", () => ({ browseAIMemory: vi.fn() }));
vi.mock("@/modules/ai/memory/registerBrowseAIMemorySkill", () => ({ BROWSE_AI_MEMORY_SKILL_ID: "browse-ai-memory" }));

import { getBloomAIOverview } from "@/modules/ai/getBloomAIOverview";
import { browseAIMemory } from "@/modules/ai/memory/browseAIMemory";
import { BROWSE_AI_MEMORY_SKILL_ID } from "@/modules/ai/memory/registerBrowseAIMemorySkill";
import { getSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";
import { resetCommandRegistry } from "@/core/commandPalette";

function makeProposal(overrides: Partial<ProposalDraft> = {}): ProposalDraft {
  return {
    id: "proposal_1",
    workspace_id: "ws_1",
    event_id: "event_1",
    client_id: "client_1",
    status: "draft",
    version: 1,
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
    generation_latency_ms: 42,
    generated_at: "2026-07-25T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-07-25T00:00:00.000Z",
    updated_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

function makeSkill(overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    id: "proposal.generate",
    name: "Proposal Generator",
    description: "Drafts a structured proposal from an Event's client profile, selected services, pricing, and consultation notes.",
    category: "proposal",
    status: "active",
    version: "proposal-generator-v1",
    provider: "mock",
    promptVersion: "proposal-generator-v1",
    capabilities: ["structured_output"],
    estimatedLatencyMs: 4000,
    requiresApproval: false,
    requiresReview: true,
    availability: "mock",
    ...overrides,
  };
}

const activeSkills: SkillMetadata[] = [
  makeSkill(),
  makeSkill({
    id: "event-operations-brief",
    name: "Event Operations Brief",
    description: "Reads an Event's current status, checklist, and schedule to draft an internal briefing and suggested next steps.",
    category: "operations",
    version: "event-brief-v2",
    promptVersion: "event-brief-v2",
    requiresReview: false,
  }),
  makeSkill({
    id: "daily-operations-brief",
    name: "Daily Operations Brief",
    description: "A workspace-wide operational summary grounded in BloomOS's own current data.",
    category: "briefing",
    version: "daily-operations-brief-v2",
    promptVersion: "daily-operations-brief-v2",
    requiresReview: false,
  }),
];

const comingSoonSkills: SkillMetadata[] = [
  { id: "crm-assistant", name: "CRM Assistant", description: "Answers questions across Leads, Clients, and Events.", category: "crm", status: "coming_soon", version: "unreleased", provider: null, promptVersion: "unreleased", capabilities: ["structured_output"], estimatedLatencyMs: null, requiresApproval: false, requiresReview: false, availability: "unavailable" },
  { id: "finance-assistant", name: "Finance Assistant", description: "Explains balances and flags overdue payments.", category: "finance", status: "coming_soon", version: "unreleased", provider: null, promptVersion: "unreleased", capabilities: ["structured_output"], estimatedLatencyMs: null, requiresApproval: false, requiresReview: false, availability: "unavailable" },
  { id: "document-assistant", name: "Document Assistant", description: "Drafts and summarizes Documents from an Event or Client's own records.", category: "documents", status: "coming_soon", version: "unreleased", provider: null, promptVersion: "unreleased", capabilities: ["structured_output"], estimatedLatencyMs: null, requiresApproval: false, requiresReview: false, availability: "unavailable" },
];

const emptyMemorySummary: AIMemorySummary = {
  totalCount: 0,
  byCategory: Object.fromEntries(AI_MEMORY_CATEGORIES.map((category) => [category, 0])) as AIMemorySummary["byCategory"],
  byImportance: { low: 0, medium: 0, high: 0 },
  pendingCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  archivedCount: 0,
  expiredCount: 0,
};

function makeData(overrides: Partial<BloomAIOverviewData> = {}): BloomAIOverviewData {
  return {
    providerConfigured: false,
    skills: [...activeSkills, ...comingSoonSkills],
    installedSkillsCount: activeSkills.length + comingSoonSkills.length,
    activeSkillsCount: activeSkills.length,
    comingSoonSkillsCount: comingSoonSkills.length,
    recentProposals: [],
    recentDailyBriefExecutions: [],
    stats: { totalGenerated: 0, accepted: 0, rejected: 0, awaitingReview: 0 },
    memorySummary: emptyMemorySummary,
    recentMemories: [],
    ...overrides,
  };
}

function makeMemory(overrides: Partial<AIMemoryEntry> = {}): AIMemoryEntry {
  return {
    id: "ai_memory_1",
    workspace_id: "ws_1",
    skill_id: "daily-operations-brief",
    entity_type: null,
    entity_id: null,
    title: "Daily Brief snapshot",
    summary: "[]",
    category: "historical_knowledge",
    importance: "low",
    visibility: "workspace",
    user_id: null,
    tags: [],
    confidence: 100,
    source: "system",
    approval_status: "approved",
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-07-25T00:00:00.000Z",
    updated_at: "2026-07-25T00:00:00.000Z",
    expires_at: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  resetSkillRunnerRegistry();
  resetCommandRegistry();
});

describe("BloomAIOverviewView", () => {
  it("shows an error with retry when loading fails", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: false, error: "The Bloom AI overview isn't available right now." } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText(/isn't available right now/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders Proposal Generator and Event Operations Brief as Active Skills", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData() } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Proposal Generator")).toBeInTheDocument());
    expect(screen.getByText("Event Operations Brief")).toBeInTheDocument();
    expect(screen.getAllByText("Mock").length).toBeGreaterThanOrEqual(2);
  });

  it("shows the empty state when there's no AI activity yet", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData() } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText(/no ai activity yet/i)).toBeInTheDocument());
  });

  it("renders recent proposal activity with status and version", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({
      success: true,
      data: makeData({ recentProposals: [makeProposal({ version: 2, status: "accepted" })] }),
    } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Proposal draft v2")).toBeInTheDocument());
    const item = screen.getByText("Proposal draft v2").closest("li");
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).getByText("Accepted")).toBeInTheDocument();
  });

  it("renders skill statistics counts from the Skill Registry", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({
      success: true,
      data: makeData({ installedSkillsCount: 6, activeSkillsCount: 2, comingSoonSkillsCount: 4 }),
    } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Skill Statistics")).toBeInTheDocument());
    expect(screen.getByText("Installed Skills")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("lists every visible Skill's prompt version", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData() } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("proposal.generate")).toBeInTheDocument());
    expect(screen.getByText("event-operations-brief")).toBeInTheDocument();
    expect(screen.getAllByText("proposal-generator-v1").length).toBeGreaterThanOrEqual(1);
  });

  it("shows a Development mock badge when no live provider is configured", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData({ providerConfigured: false }) } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Development mock")).toBeInTheDocument());
  });

  it("shows a live-provider badge when a real provider is configured", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData({ providerConfigured: true }) } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Live provider connected")).toBeInTheDocument());
  });

  it("labels every Coming Soon Skill from the Skill Registry, not a hardcoded list", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData() } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("CRM Assistant")).toBeInTheDocument());
    for (const name of ["CRM Assistant", "Finance Assistant", "Document Assistant"]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Coming Soon")).toHaveLength(3);
  });

  it("renders the Daily Operations Brief as an Active Skill", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData() } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Daily Operations Brief")).toBeInTheDocument());
  });

  it("renders the Daily Brief's own execution history alongside the Proposal list", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({
      success: true,
      data: makeData({
        recentDailyBriefExecutions: [
          { id: "exec_1", workspace_id: "ws_1", status: "success", provider: "mock", model: "bloomos-daily-mock-v2", prompt_version: "daily-operations-brief-v2", mock: true, latency_ms: 42, generated_at: "2026-07-25T00:00:00.000Z", created_at: "2026-07-25T00:00:00.000Z" },
        ],
      }),
    } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText(/42ms/)).toBeInTheDocument());
    expect(screen.getAllByText("Daily Operations Brief").length).toBeGreaterThanOrEqual(1);
  });

  it("renders Memory Usage, Knowledge Statistics, and Memory Health from the Memory Manager's own summary", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({
      success: true,
      data: makeData({
        memorySummary: {
          totalCount: 4,
          byCategory: { ...emptyMemorySummary.byCategory, historical_knowledge: 3, workspace_knowledge: 1 },
          byImportance: { low: 3, medium: 1, high: 0 },
          pendingCount: 1,
          approvedCount: 2,
          rejectedCount: 0,
          archivedCount: 0,
          expiredCount: 1,
        },
      }),
    } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);

    await waitFor(() => expect(screen.getByText("Memory Usage")).toBeInTheDocument());
    expect(screen.getByText("Knowledge Statistics")).toBeInTheDocument();
    expect(screen.getByText("Memory Health")).toBeInTheDocument();
    expect(screen.getByText("Historical Knowledge")).toBeInTheDocument();
    expect(screen.getByText(/1 memory is awaiting review/)).toBeInTheDocument();
  });

  it("shows the empty state when this Workspace has no memory yet", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData() } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText(/no memory recorded yet/i)).toBeInTheDocument());
  });

  it("renders Recent Memories with title, category, and approval status", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({
      success: true,
      data: makeData({ recentMemories: [makeMemory({ title: "Daily Brief snapshot — 2026-07-25" })] }),
    } satisfies GetBloomAIOverviewResult);
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Daily Brief snapshot — 2026-07-25")).toBeInTheDocument());
    const item = screen.getByText("Daily Brief snapshot — 2026-07-25").closest("li");
    expect(item).not.toBeNull();
    expect(within(item as HTMLElement).getByText("Historical Knowledge")).toBeInTheDocument();
    expect(within(item as HTMLElement).getByText("approved")).toBeInTheDocument();
  });

  it("running the Browse AI Memory Skill (via its registered runner) shows a Full Memory Browser panel", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData() } satisfies GetBloomAIOverviewResult);
    vi.mocked(browseAIMemory).mockResolvedValue({ success: true, data: { memories: [makeMemory({ title: "Browsed memory" })] } });
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Bloom AI")).toBeInTheDocument());

    const runner = getSkillRunner(BROWSE_AI_MEMORY_SKILL_ID);
    expect(runner).toBeDefined();
    await runner?.();

    await waitFor(() => expect(screen.getByText("Full Memory Browser")).toBeInTheDocument());
    expect(screen.getByText("Browsed memory")).toBeInTheDocument();
  });

  it("shows a safe error in the Full Memory Browser panel when Browse AI Memory fails", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: true, data: makeData() } satisfies GetBloomAIOverviewResult);
    vi.mocked(browseAIMemory).mockResolvedValue({ success: false, error: "AI Memory isn't available right now. You may not have access to it." });
    render(<BloomAIOverviewView />);
    await waitFor(() => expect(screen.getByText("Bloom AI")).toBeInTheDocument());

    const runner = getSkillRunner(BROWSE_AI_MEMORY_SKILL_ID);
    await runner?.();

    await waitFor(() => expect(screen.getByText(/isn't available right now/i)).toBeInTheDocument());
  });
});
