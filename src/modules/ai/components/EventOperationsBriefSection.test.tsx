import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EventOperationsBriefSection } from "@/modules/ai/components/EventOperationsBriefSection";
import { getSkillRunner, resetSkillRunnerRegistry } from "@/core/ai/skills/runnerRegistry";
import { EVENT_OPERATIONS_BRIEF_SKILL_ID } from "@/modules/ai/registerEventOperationsBriefSkill";
import type { GenerateEventOperationsBriefResult, GeneratedEventOperationsBrief, EventOperationsBrief } from "@/modules/ai/types";

vi.mock("@/modules/ai/generateEventOperationsBrief", () => ({
  generateEventOperationsBrief: vi.fn(),
}));

import { generateEventOperationsBrief } from "@/modules/ai/generateEventOperationsBrief";

afterEach(() => {
  vi.clearAllMocks();
  resetSkillRunnerRegistry();
});

function makeBrief(
  overrides: Omit<Partial<GeneratedEventOperationsBrief>, "brief"> & { brief?: Partial<EventOperationsBrief> } = {},
): GeneratedEventOperationsBrief {
  const { brief: briefOverrides, ...rest } = overrides;
  return {
    context: {
      event: {
        id: "event_1",
        title: "Beachfront Proposal",
        eventType: "Proposal",
        status: "Confirmed",
        lifecycleStage: "Preparation",
        priority: "High",
        eventDate: "2026-09-01",
        locationName: "El Matador State Beach",
        assignedOwner: null,
        updatedAt: "2026-07-20T00:00:00.000Z",
      },
      client: { name: "Jamie Rivera" },
      health: { status: "waiting", score: 80, riskReasons: [], topFactors: [{ label: "Missing budget", deduction: 10 }] },
      checklist: { total: 4, completed: 2, overdueCount: 0, overdueTitles: [] },
      schedule: { total: 1, nextItem: { title: "Setup", startTime: "2026-09-01T15:00:00.000Z" }, delayedCount: 0 },
      missingInformation: ["Missing budget"],
      overdueSummary: "Nothing overdue.",
      deterministicNextAction: "Set a budget range",
      detectedRisks: [{ kind: "incomplete_information", label: "Incomplete event information", severity: "low", evidence: "Missing: Missing budget." }],
      confidence: { score: 86, reason: "Missing: no budget." },
      generatedAt: "2026-07-23T17:00:00.000Z",
    },
    brief: {
      executiveSummary: "Event is progressing normally with one open gap.",
      healthExplanation: "Health is waiting at 80/100, driven mainly by: Missing budget (-10).",
      riskExplanations: [
        {
          risk: { kind: "incomplete_information", label: "Incomplete event information", severity: "low", evidence: "Missing: Missing budget." },
          explanation: "The budget hasn't been set yet, which limits planning precision.",
        },
      ],
      recommendedActions: [
        { id: "action-0", label: "Set a budget range", reason: "Health scoring already flags this as missing.", actionTarget: { type: "event", href: "/events/event_1", label: "Open Event" } },
      ],
      preparationNotes: null,
      internalNotes: null,
      ...briefOverrides,
    },
    mock: true,
    model: "bloomos-mock-v2",
    provider: "mock",
    promptVersion: "event-operations-brief-v2",
    contextVersion: "event-operations-brief-context-v2",
    sourceEventUpdatedAt: "2026-07-20T00:00:00.000Z",
    generatedAt: "2026-07-23T17:00:00.000Z",
    ...rest,
  };
}

describe("EventOperationsBriefSection", () => {
  it("shows an idle prompt before any generation", () => {
    render(<EventOperationsBriefSection eventId="event_1" />);
    expect(screen.getByText(/no brief has been generated yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate ai brief/i })).toBeInTheDocument();
  });

  it("renders the full structured brief on success, including the mock-mode disclosure", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief() });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);

    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByText(/progressing normally/i)).toBeInTheDocument());
    expect(screen.getByText(/development mock/i)).toBeInTheDocument();
    expect(screen.getByText("Jamie Rivera")).toBeInTheDocument();
    expect(screen.getByText("Set a budget range")).toBeInTheDocument();
    expect(screen.getByText("Missing budget")).toBeInTheDocument();
  });

  it("renders the Health Score explanation without a second score", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief() });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);
    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByText(/driven mainly by/i)).toBeInTheDocument());
  });

  it("renders each detected risk with its explanation", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief() });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);
    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByText("Incomplete event information")).toBeInTheDocument());
    expect(screen.getByText(/hasn't been set yet/i)).toBeInTheDocument();
  });

  it("renders a reason alongside every recommended action, never a bare label", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief() });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);
    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByText("Set a budget range")).toBeInTheDocument());
    expect(screen.getByText(/already flags this as missing/i)).toBeInTheDocument();
  });

  it("links a recommended action to its resolved destination", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief() });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);
    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByRole("link", { name: "Open Event" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Open Event" })).toHaveAttribute("href", "/events/event_1");
  });

  it("shows the deterministic confidence score, not a model-reported one", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief() });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);
    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByText(/confidence: 86%/i)).toBeInTheDocument());
  });

  it("labels a live (non-mock) result as AI-generated, not mock", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief({ mock: false }) });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);
    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByText(/^AI-generated$/i)).toBeInTheDocument());
    expect(screen.queryByText(/development mock/i)).not.toBeInTheDocument();
  });

  it("shows an alert with retry on failure, never a raw error", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({
      success: false,
      error: "This Event brief isn't available. It may not exist, or you may not have access to it.",
    });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);
    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent(/isn't available/i);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("disables the Generate button while a request is in flight (duplicate-submit prevention)", async () => {
    let resolveCall: (value: GenerateEventOperationsBriefResult) => void = () => {};
    vi.mocked(generateEventOperationsBrief).mockImplementation(
      () => new Promise((resolve) => { resolveCall = resolve; }),
    );
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);

    const button = screen.getByRole("button", { name: /generate ai brief/i });
    await user.click(button);

    expect(button).toBeDisabled();
    await user.click(button); // second click while pending must not fire a second call
    expect(generateEventOperationsBrief).toHaveBeenCalledTimes(1);

    resolveCall({ success: true, data: makeBrief() });
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("replaces the previous result on regeneration rather than appending or merging", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValueOnce({
      success: true,
      data: makeBrief({ brief: { executiveSummary: "First brief." } }),
    });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);

    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));
    await waitFor(() => expect(screen.getByText(/first brief/i)).toBeInTheDocument());

    vi.mocked(generateEventOperationsBrief).mockResolvedValueOnce({
      success: true,
      data: makeBrief({ brief: { executiveSummary: "Second, regenerated brief." } }),
    });
    await user.click(screen.getByRole("button", { name: /regenerate ai brief/i }));

    await waitFor(() => expect(screen.getByText(/second, regenerated brief/i)).toBeInTheDocument());
    expect(screen.queryByText(/first brief/i)).not.toBeInTheDocument();
    expect(generateEventOperationsBrief).toHaveBeenCalledTimes(2);
  });

  it("shows a heading and accessible structure for the generated sections", async () => {
    vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief() });
    const user = userEvent.setup();
    render(<EventOperationsBriefSection eventId="event_1" />);
    await user.click(screen.getByRole("button", { name: /generate ai brief/i }));

    await waitFor(() => expect(screen.getByRole("heading", { name: /ai operations brief/i })).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: /executive summary/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /health score explanation/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /recommended actions/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate ai brief/i })).toBeInTheDocument();
  });

  describe("Bloom AI Skill runner integration", () => {
    it("registers itself as the Event Operations Brief Skill's runner while mounted", () => {
      const { unmount } = render(<EventOperationsBriefSection eventId="event_1" />);
      expect(getSkillRunner(EVENT_OPERATIONS_BRIEF_SKILL_ID)).toBeDefined();
      unmount();
    });

    it("unregisters its runner on unmount", () => {
      const { unmount } = render(<EventOperationsBriefSection eventId="event_1" />);
      unmount();
      expect(getSkillRunner(EVENT_OPERATIONS_BRIEF_SKILL_ID)).toBeUndefined();
    });

    it("running the Skill Picker's Event Operations Brief card generates the brief, same as clicking Generate", async () => {
      vi.mocked(generateEventOperationsBrief).mockResolvedValue({ success: true, data: makeBrief() });
      render(<EventOperationsBriefSection eventId="event_1" />);

      await getSkillRunner(EVENT_OPERATIONS_BRIEF_SKILL_ID)?.();

      await waitFor(() => expect(screen.getByText(/progressing normally/i)).toBeInTheDocument());
      expect(generateEventOperationsBrief).toHaveBeenCalledWith("event_1");
    });
  });
});
