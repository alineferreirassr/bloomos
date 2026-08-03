import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BloomAISkillPicker } from "@/modules/ai/components/BloomAISkillPicker";
import { getCommandById, resetCommandRegistry } from "@/core/commandPalette";
import { registerSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";
import type { GetBloomAIOverviewResult } from "@/modules/ai/getBloomAIOverview";
import type { SkillMetadata } from "@/core/ai/skills/types";
import type { AIMemorySummary } from "@/types/aiMemory";
import { AI_MEMORY_CATEGORIES } from "@/types/aiMemory";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/modules/ai/getBloomAIOverview", () => ({ getBloomAIOverview: vi.fn() }));

import { getBloomAIOverview } from "@/modules/ai/getBloomAIOverview";

function makeSkill(overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    id: "event-operations-brief",
    name: "Event Operations Brief",
    description: "Reads an Event's current status and drafts an internal briefing.",
    category: "operations",
    status: "active",
    version: "event-brief-v2",
    provider: "mock",
    promptVersion: "event-brief-v2",
    capabilities: ["structured_output"],
    estimatedLatencyMs: 3000,
    requiresApproval: false,
    requiresReview: false,
    availability: "mock",
    ...overrides,
  };
}

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

function makeResult(skills: SkillMetadata[]): GetBloomAIOverviewResult {
  return {
    success: true,
    data: {
      providerConfigured: false,
      skills,
      installedSkillsCount: skills.length,
      activeSkillsCount: skills.filter((s) => s.status === "active").length,
      comingSoonSkillsCount: skills.filter((s) => s.status === "coming_soon").length,
      recentProposals: [],
      recentDailyBriefExecutions: [],
      stats: { totalGenerated: 0, accepted: 0, rejected: 0, awaitingReview: 0 },
      memorySummary: emptyMemorySummary,
      recentMemories: [],
    },
  };
}

afterEach(() => {
  vi.clearAllMocks();
  resetCommandRegistry();
  resetSkillRunnerRegistry();
});

describe("BloomAISkillPicker", () => {
  it("registers the 'Ask Bloom' command while mounted, and removes it on unmount", () => {
    const { unmount } = render(<BloomAISkillPicker />);
    expect(getCommandById("ask-bloom")).toMatchObject({ label: "Ask Bloom", group: "Bloom AI" });
    unmount();
    expect(getCommandById("ask-bloom")).toBeUndefined();
  });

  it("opens the picker on button click and loads Skills from the registry", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue(makeResult([makeSkill()]));
    const user = userEvent.setup();
    render(<BloomAISkillPicker />);

    await user.click(screen.getByRole("button", { name: "Ask Bloom" }));
    expect(screen.getByRole("dialog", { name: "Ask Bloom" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Event Operations Brief")).toBeInTheDocument());
  });

  it("running the 'Ask Bloom' command opens the picker, same as clicking the button", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue(makeResult([makeSkill()]));
    render(<BloomAISkillPicker />);

    await getCommandById("ask-bloom")?.run();
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Ask Bloom" })).toBeInTheDocument());
  });

  it("disables Coming Soon Skills and labels them accordingly", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue(
      makeResult([makeSkill({ id: "crm-assistant", name: "CRM Assistant", status: "coming_soon", availability: "unavailable" })]),
    );
    const user = userEvent.setup();
    render(<BloomAISkillPicker />);
    await user.click(screen.getByRole("button", { name: "Ask Bloom" }));

    const card = await screen.findByRole("button", { name: /CRM Assistant/ });
    expect(card).toBeDisabled();
    expect(screen.getByText("Coming Soon")).toBeInTheDocument();
  });

  it("running an Active Skill with a registered runner delegates to it and closes the picker", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue(makeResult([makeSkill()]));
    const runner = vi.fn();
    registerSkillRunner("event-operations-brief", runner);
    const user = userEvent.setup();
    render(<BloomAISkillPicker />);
    await user.click(screen.getByRole("button", { name: "Ask Bloom" }));

    const card = await screen.findByRole("button", { name: /Event Operations Brief/ });
    await user.click(card);

    expect(runner).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("falls back to navigating to /bloom-ai when no runner is registered for the current page", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue(makeResult([makeSkill()]));
    const user = userEvent.setup();
    render(<BloomAISkillPicker />);
    await user.click(screen.getByRole("button", { name: "Ask Bloom" }));

    const card = await screen.findByRole("button", { name: /Event Operations Brief/ });
    await user.click(card);

    expect(pushMock).toHaveBeenCalledWith("/bloom-ai");
  });

  it("shows an error message when the overview fails to load", async () => {
    vi.mocked(getBloomAIOverview).mockResolvedValue({ success: false, error: "The Bloom AI overview isn't available right now." });
    const user = userEvent.setup();
    render(<BloomAISkillPicker />);
    await user.click(screen.getByRole("button", { name: "Ask Bloom" }));

    await waitFor(() => expect(screen.getByText(/isn't available right now/i)).toBeInTheDocument());
  });
});
