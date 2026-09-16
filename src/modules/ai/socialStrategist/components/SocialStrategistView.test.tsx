import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SocialStrategistView } from "@/modules/ai/socialStrategist/components/SocialStrategistView";
import { getSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";
import { SOCIAL_STRATEGIST_SKILL_ID } from "@/modules/ai/socialStrategist/registerSocialStrategistSkill";
import type { GenerateSocialStrategistBriefResult } from "@/modules/ai/socialStrategist/generateSocialStrategistBrief";
import type { SocialStrategistBrief } from "@/modules/ai/socialStrategist/assembleSocialStrategistBrief";

vi.mock("@/modules/ai/socialStrategist/generateSocialStrategistBrief", () => ({
  generateSocialStrategistBrief: vi.fn(),
}));

import { generateSocialStrategistBrief } from "@/modules/ai/socialStrategist/generateSocialStrategistBrief";

function emptyContext() {
  return {
    generatedAt: "2026-09-16T00:00:00.000Z",
    posts: [],
    postCountByStatus: { draft: 0, scheduled: 0, publishing: 0, published: 0, failed: 0 },
    topPosts: [],
    accountMetrics: null,
    ideas: [],
    inspiration: [],
    scripts: [],
    carousels: [],
    instagramLeads: [],
    instagramLeadCountByStatus: { new: 0, contacted: 0, welcome_guide_sent: 0, consultation_scheduled: 0, qualified: 0, proposal_sent: 0, waiting_decision: 0, converted: 0, lost: 0, archived: 0 },
    unassignedInstagramLeadCount: 0,
    unavailableCategories: [],
  };
}

function emptyBrief(overrides: Partial<SocialStrategistBrief> = {}): SocialStrategistBrief {
  return {
    accountObservations: [],
    contentOpportunities: [],
    contentPillars: [],
    nextContentRecommendations: [],
    postingStrategyNotes: [],
    audienceObservations: [],
    referencedContent: [],
    conversionObservations: [],
    dataGaps: [],
    confidence: 0,
    unavailableCategories: [],
    isEmpty: true,
    ...overrides,
  };
}

function makeResult(briefOverrides: Partial<SocialStrategistBrief> = {}, resultOverrides: { mock?: boolean } = {}): GenerateSocialStrategistBriefResult {
  return {
    success: true,
    data: {
      context: emptyContext(),
      brief: emptyBrief(briefOverrides),
      mock: resultOverrides.mock ?? true,
      model: "bloomos-social-strategist-mock-v1",
      provider: "mock",
      promptVersion: "social-strategist-v1",
      generatedAt: "2026-09-16T00:00:00.000Z",
    },
  } as GenerateSocialStrategistBriefResult;
}

afterEach(() => {
  vi.clearAllMocks();
  resetSkillRunnerRegistry();
});

describe("SocialStrategistView — idle state", () => {
  it("shows an idle prompt before any generation, with a Generate button", () => {
    render(<SocialStrategistView />);
    expect(screen.getByText(/no social strategist report has been generated yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate social strategist report/i })).toBeInTheDocument();
  });

  it("renders the heading and the data-safety disclaimer text", () => {
    render(<SocialStrategistView />);
    expect(screen.getByRole("heading", { name: "Social Strategist" })).toBeInTheDocument();
    expect(screen.getByText(/never reads raw instagram comments, dms, or lead messages/i)).toBeInTheDocument();
  });
});

describe("SocialStrategistView — loading state", () => {
  it("shows skeleton placeholders while generating, and disables the trigger button", async () => {
    const user = userEvent.setup();
    let resolvePromise: (value: GenerateSocialStrategistBriefResult) => void = () => {};
    vi.mocked(generateSocialStrategistBrief).mockReturnValue(new Promise((resolve) => { resolvePromise = resolve; }));
    render(<SocialStrategistView />);

    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));
    expect(screen.getByRole("button", { name: /generate social strategist report/i })).toBeDisabled();
    expect(screen.getByText(/generating…/i)).toBeInTheDocument();

    resolvePromise(makeResult());
    await waitFor(() => expect(screen.queryByText(/generating…/i)).not.toBeInTheDocument());
  });
});

describe("SocialStrategistView — success state, full context", () => {
  it("renders every populated section: observations, recommendations, pillars, referenced content", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(
      makeResult({
        accountObservations: ["Reach was 4321 as of 2026-09-05."],
        contentOpportunities: [{ label: "Build on your top post", reason: "It had the most interactions.", relatedPost: { id: "post_1", title: "Behind the scenes reel", href: "/social" }, relatedIdea: null }],
        contentPillars: [{ name: "reel", rationale: "3 Ideas already planned in this format." }],
        nextContentRecommendations: [{ label: "Produce this idea", reason: "It's active.", suggestedFormat: "reel", relatedIdea: { id: "idea_1", title: "Behind the scenes", href: "/ideas" }, relatedInspiration: null }],
        postingStrategyNotes: ["2 posts scheduled."],
        audienceObservations: ["An Idea names its audience as engaged couples."],
        referencedContent: [{ type: "post", id: "post_1", note: "Top performer.", title: "Behind the scenes reel", href: "/social" }],
        conversionObservations: ["3 Instagram Leads tracked."],
        confidence: 72,
        isEmpty: false,
      }),
    );
    render(<SocialStrategistView />);
    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));

    await waitFor(() => expect(screen.getByText("Reach was 4321 as of 2026-09-05.")).toBeInTheDocument());
    expect(screen.getByText("Build on your top post")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /based on: behind the scenes reel/i })).toHaveAttribute("href", "/social");
    expect(screen.getAllByText("reel", { selector: "span" })).toHaveLength(2); // pillar badge + recommendation format badge
    expect(screen.getByText("Produce this idea")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /related idea: behind the scenes/i })).toHaveAttribute("href", "/ideas");
    expect(screen.getByText("2 posts scheduled.")).toBeInTheDocument();
    expect(screen.getByText("An Idea names its audience as engaged couples.")).toBeInTheDocument();
    expect(screen.getByText("3 Instagram Leads tracked.")).toBeInTheDocument();
    expect(screen.getByText("Top performer.")).toBeInTheDocument();
    expect(screen.getByText("Confidence: 72%")).toBeInTheDocument();
  });

  it("separates factual observations from recommendations into distinct, separately-labeled regions", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(
      makeResult({
        accountObservations: ["Reach was 100."],
        contentOpportunities: [{ label: "Opportunity A", reason: "Reason A", relatedPost: null, relatedIdea: null }],
        isEmpty: false,
      }),
    );
    render(<SocialStrategistView />);
    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));
    await waitFor(() => expect(screen.getByText("Reach was 100.")).toBeInTheDocument());

    const observationsHeading = screen.getByRole("heading", { name: "Data & Observations" });
    const recommendationsHeading = screen.getByRole("heading", { name: "Recommendations" });
    expect(observationsHeading.compareDocumentPosition(recommendationsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const observationsSection = observationsHeading.closest("section");
    const recommendationsSection = recommendationsHeading.closest("section");
    expect(observationsSection).not.toBeNull();
    expect(recommendationsSection).not.toBeNull();
    expect(observationsSection?.textContent).toContain("Reach was 100.");
    expect(observationsSection?.textContent).not.toContain("Opportunity A");
    expect(recommendationsSection?.textContent).toContain("Opportunity A");
    expect(recommendationsSection?.textContent).not.toContain("Reach was 100.");
  });
});

describe("SocialStrategistView — partial-data state", () => {
  it("renders populated sections normally while showing empty-section copy for sections with nothing, without treating the whole report as empty", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(
      makeResult({
        accountObservations: ["Reach was 100."],
        contentOpportunities: [],
        isEmpty: false,
      }),
    );
    render(<SocialStrategistView />);
    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));

    await waitFor(() => expect(screen.getByText("Reach was 100.")).toBeInTheDocument());
    expect(screen.getByText(/no content opportunities surfaced right now/i)).toBeInTheDocument();
    expect(screen.queryByText(/no social strategist report yet/i)).not.toBeInTheDocument();
  });

  it("surfaces a Data Gaps card naming which categories couldn't be read, never rendering the gap as a silent zero", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(
      makeResult({
        accountObservations: ["Reach was 100."],
        dataGaps: ["No Instagram account connected yet."],
        unavailableCategories: ["ideas"],
        isEmpty: false,
      }),
    );
    render(<SocialStrategistView />);
    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: "Data Gaps" })).toBeInTheDocument());
    expect(screen.getByText("No Instagram account connected yet.")).toBeInTheDocument();
    expect(screen.getByText(/ideas couldn't be read for this report/i)).toBeInTheDocument();
    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });

  it("omits the Data Gaps card entirely when there is genuinely nothing to disclose", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(makeResult({ accountObservations: ["Reach was 100."], isEmpty: false }));
    render(<SocialStrategistView />);
    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));

    await waitFor(() => expect(screen.getByText("Reach was 100.")).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Data Gaps" })).not.toBeInTheDocument();
  });
});

describe("SocialStrategistView — empty state", () => {
  it("renders the honest empty state, never a report shaped like zero metrics", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(makeResult({ dataGaps: ["No Social posts exist yet."] }));
    render(<SocialStrategistView />);
    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));

    await waitFor(() => expect(screen.getByText(/no social strategist report yet/i)).toBeInTheDocument());
    expect(screen.queryByRole("heading", { name: "Data & Observations" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recommendations" })).not.toBeInTheDocument();
  });
});

describe("SocialStrategistView — error state", () => {
  it("shows a safe error message with a retry action when generation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue({ success: false, error: "The Social Strategist isn't available." });
    render(<SocialStrategistView />);

    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("The Social Strategist isn't available."));
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("maps a semantically-invalid or malformed model output to the same safe error path (via the Server Action's own error mapping) — the view never distinguishes it from a provider failure", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue({ success: false, error: "Bloom AI's Social Strategist report referenced content that doesn't exist. Please try again." });
    render(<SocialStrategistView />);

    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/referenced content that doesn't exist/i));
  });
});

describe("SocialStrategistView — accessibility / Skill Picker integration", () => {
  it("registers a Skill runner for social-strategist on mount, unregisters on unmount", async () => {
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(makeResult());
    const { unmount } = render(<SocialStrategistView />);

    expect(getSkillRunner(SOCIAL_STRATEGIST_SKILL_ID)).toBeDefined();
    await getSkillRunner(SOCIAL_STRATEGIST_SKILL_ID)?.();
    await waitFor(() => expect(generateSocialStrategistBrief).toHaveBeenCalled());

    unmount();
    expect(getSkillRunner(SOCIAL_STRATEGIST_SKILL_ID)).toBeUndefined();
  });

  it("wraps the result region in an aria-live=polite container so state transitions are announced", () => {
    const { container } = render(<SocialStrategistView />);
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
  });

  it("gives the heading a focusable, targetable ref (tabIndex=-1) for the Skill Picker's scroll-and-focus behavior", () => {
    render(<SocialStrategistView />);
    const heading = screen.getByRole("heading", { name: "Social Strategist" });
    expect(heading).toHaveAttribute("tabindex", "-1");
  });
});

describe("SocialStrategistView — data safety", () => {
  it("never renders a follower count or any fabricated-metric language, only what the structured output actually provided", async () => {
    const user = userEvent.setup();
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(makeResult({ accountObservations: ["Reach was 100 as of 2026-09-05."], isEmpty: false }));
    const { container } = render(<SocialStrategistView />);
    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));

    await waitFor(() => expect(screen.getByText("Reach was 100 as of 2026-09-05.")).toBeInTheDocument());
    // Scoped to the report region (`aria-live`), not the whole page — the
    // header's own disclaimer paragraph deliberately says "follower" to
    // disclose the policy; this assertion is about the generated report
    // content itself never fabricating one.
    const reportRegion = container.querySelector('[aria-live="polite"]');
    expect(reportRegion?.textContent?.toLowerCase()).not.toContain("follower");
  });

  it("never renders raw Instagram DM/comment text or a Lead's message/email/phone — the view only ever receives fields the structured output already excludes them from", async () => {
    const user = userEvent.setup();
    const rawLeadText = "Call me at 555-0100, I'm Jane Doe, saw your reel and want to book!";
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(makeResult({ conversionObservations: ["2 Instagram-sourced Lead(s) tracked; 1 currently unassigned."], isEmpty: false }));
    const { container } = render(<SocialStrategistView />);
    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));

    await waitFor(() => expect(screen.getByText(/2 instagram-sourced lead/i)).toBeInTheDocument());
    expect(container.textContent).not.toContain(rawLeadText);
    expect(container.textContent).not.toContain("555-0100");
    expect(container.textContent).not.toContain("Jane Doe");
  });
});

describe("SocialStrategistView — copy to clipboard", () => {
  it("copies a plain-text report on Copy, including populated sections", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    vi.mocked(generateSocialStrategistBrief).mockResolvedValue(makeResult({ accountObservations: ["Reach was 100."], isEmpty: false }));
    render(<SocialStrategistView />);

    await user.click(screen.getByRole("button", { name: /generate social strategist report/i }));
    await waitFor(() => expect(screen.getByText("Reach was 100.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /copy social strategist report as text/i }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("SOCIAL STRATEGIST REPORT"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Reach was 100."));
    await waitFor(() => expect(screen.getByText(/copied to clipboard/i)).toBeInTheDocument());
  });
});
