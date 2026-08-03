import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ObjectivesSection } from "@/modules/objectives/components/ObjectivesSection";
import type { EvaluateObjectivesResult } from "@/modules/objectives/objectivesActions";
import type { Objective } from "@/types/objectives";

vi.mock("@/modules/objectives/objectivesActions", () => ({
  evaluateObjectivesAction: vi.fn(),
}));

import { evaluateObjectivesAction } from "@/modules/objectives/objectivesActions";

function makeObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: "objective_1",
    workspace_id: "ws_1",
    scope: "event",
    node: { nodeType: "event", nodeId: "event_1" },
    title: "Event is fully ready",
    description: null,
    status: "in_progress",
    requirements: [],
    dependencies: [],
    due_date: null,
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function makeResult(overrides: Partial<EvaluateObjectivesResult> = {}): EvaluateObjectivesResult {
  return {
    evaluations: [
      {
        objective: makeObjective(),
        progress: { objectiveId: "objective_1", completionPercent: 60, missingRequirements: [], blockingIssues: [], remainingTasks: [], estimatedProgress: 60 },
        health: { objectiveId: "objective_1", state: "at_risk", effectiveStatus: "in_progress", reasons: [], recommendations: [] },
      },
    ],
    scorecard: { objectivesCompleted: 2, objectivesBlocked: 1, objectivesOverdue: 0, averageCompletion: 60, operationalProgress: 40, businessReadiness: 80, overallOperationalScore: 70, evaluatedAt: "2026-07-30T00:00:00.000Z" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ObjectivesSection", () => {
  it("renders the scorecard KPIs and the objective's progress bar once evaluation succeeds", async () => {
    vi.mocked(evaluateObjectivesAction).mockResolvedValue({ success: true, data: makeResult() });

    render(<ObjectivesSection />);

    expect(await screen.findByText("Event is fully ready")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getAllByText("2").length).toBeGreaterThan(0); // Objectives Completed
  });

  it("lists a blocked objective under Blocked Objectives with its reasons", async () => {
    const blockedResult = makeResult({
      evaluations: [
        {
          objective: makeObjective({ title: "Contract needs signature" }),
          progress: { objectiveId: "objective_1", completionPercent: 40, missingRequirements: [], blockingIssues: ["Needs sign-off"], remainingTasks: [], estimatedProgress: 40 },
          health: { objectiveId: "objective_1", state: "blocked", effectiveStatus: "blocked", reasons: ["Needs sign-off"], recommendations: [] },
        },
      ],
    });
    vi.mocked(evaluateObjectivesAction).mockResolvedValue({ success: true, data: blockedResult });

    render(<ObjectivesSection />);

    expect((await screen.findAllByText("Contract needs signature")).length).toBeGreaterThan(0);
    expect(screen.getByText("Needs sign-off")).toBeInTheDocument();
  });

  it("lists an objective with a due date under Upcoming Objectives", async () => {
    const upcomingResult = makeResult({
      evaluations: [
        {
          objective: makeObjective({ title: "Vendor confirmed", due_date: "2026-08-05T00:00:00.000Z" }),
          progress: { objectiveId: "objective_1", completionPercent: 80, missingRequirements: [], blockingIssues: [], remainingTasks: [], estimatedProgress: 80 },
          health: { objectiveId: "objective_1", state: "on_track", effectiveStatus: "in_progress", reasons: [], recommendations: [] },
        },
      ],
    });
    vi.mocked(evaluateObjectivesAction).mockResolvedValue({ success: true, data: upcomingResult });

    render(<ObjectivesSection />);

    expect((await screen.findAllByText("Vendor confirmed")).length).toBeGreaterThan(0);
    expect(screen.getByText(/d left/)).toBeInTheDocument();
  });

  it("shows an error state when evaluation fails", async () => {
    vi.mocked(evaluateObjectivesAction).mockResolvedValue({ success: false, error: "Objectives aren't available. You may not have access to them." });

    render(<ObjectivesSection />);

    expect(await screen.findByText("Objectives aren't available. You may not have access to them.")).toBeInTheDocument();
  });

  it("shows an empty state when there are no objectives", async () => {
    vi.mocked(evaluateObjectivesAction).mockResolvedValue({ success: true, data: makeResult({ evaluations: [] }) });

    render(<ObjectivesSection />);

    expect(await screen.findByText("No objectives yet")).toBeInTheDocument();
    expect(screen.getByText("No blocked objectives.")).toBeInTheDocument();
    expect(screen.getByText("No objectives with an upcoming due date.")).toBeInTheDocument();
  });
});
