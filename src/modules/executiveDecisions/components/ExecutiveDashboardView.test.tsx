import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExecutiveDashboardView } from "@/modules/executiveDecisions/components/ExecutiveDashboardView";
import type { EvaluateExecutiveDecisionsResult } from "@/modules/executiveDecisions/executiveDecisionsActions";
import type { Decision } from "@/types/executiveDecisions";

vi.mock("@/modules/executiveDecisions/executiveDecisionsActions", () => ({
  evaluateExecutiveDecisionsAction: vi.fn(),
  updateDecisionStatusAction: vi.fn(),
}));

import { evaluateExecutiveDecisionsAction, updateDecisionStatusAction } from "@/modules/executiveDecisions/executiveDecisionsActions";

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "decision_1",
    workspace_id: "ws_1",
    title: "Resolve missing contract",
    description: "x",
    category: "compliance",
    priority: "critical",
    status: "open",
    reason: "x",
    generated_by: "x",
    created_at: "2026-01-01T00:00:00.000Z",
    resolved_at: null,
    resolution_notes: null,
    related_entities: [],
    related_assets: [],
    related_objective_ids: [],
    related_timeline_activity_ids: [],
    dependencies: [],
    dedupe_key: "x",
    ...overrides,
  };
}

function makeResult(overrides: Partial<EvaluateExecutiveDecisionsResult> = {}): EvaluateExecutiveDecisionsResult {
  const decision = makeDecision();
  return {
    queue: [decision],
    allDecisions: [decision],
    decisionScores: {
      decision_1: {
        decisionScore: 80,
        urgencyScore: 80,
        businessImpactScore: 80,
        dependencyScore: 100,
        riskScore: 80,
        complexityScore: 0,
        confidence: 100,
        overallExecutiveScore: 80,
        readiness: { source: "workspace", value: 70, isFallback: false, priorityContribution: 6 },
      },
    },
    resolvedDecisions: [],
    blockedDecisions: [],
    scorecard: { operationalScore: 70, businessScore: 80, decisionScore: 80, readinessScore: 75, knowledgeScore: 90, objectiveScore: 65, overallExecutiveScore: 77, evaluatedAt: "2026-07-30T00:00:00.000Z" },
    insights: {
      mostImpactedClients: [],
      mostBlockedObjectives: [],
      mostCriticalAssets: [],
      mostReferencedDocuments: [],
      mostViolatedBusinessRules: [{ ruleId: "circular_dependency", count: 2 }],
      mostOverloadedEvents: [],
      mostFragileWorkflows: { entries: [], notApplicableReason: "No workflow health signal exists yet." },
    },
    report: {
      executiveSummary: "Overall Executive Score is 77/100.",
      criticalIssues: ["Resolve missing contract"],
      businessRisks: [],
      operationalRisks: [],
      decisionQueueSummary: "1 decision(s) in the queue.",
      completedDecisionsSummary: "No decisions have been resolved yet.",
      blockedDecisionsSummary: "No decisions are currently blocked.",
      topImprovements: ["Resolve missing contract"],
      evaluatedAt: "2026-07-30T00:00:00.000Z",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ExecutiveDashboardView", () => {
  it("renders the overall score and the critical decision once evaluation succeeds", async () => {
    vi.mocked(evaluateExecutiveDecisionsAction).mockResolvedValue({ success: true, data: makeResult() });

    render(<ExecutiveDashboardView />);

    expect((await screen.findAllByText("77")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Resolve missing contract").length).toBeGreaterThan(0);
  });

  it("shows an error state when evaluation fails", async () => {
    vi.mocked(evaluateExecutiveDecisionsAction).mockResolvedValue({ success: false, error: "Executive Decisions aren't available. You may not have access to them." });

    render(<ExecutiveDashboardView />);

    expect(await screen.findByText("Executive Decisions aren't available. You may not have access to them.")).toBeInTheDocument();
  });

  it("resolves a decision when Resolve is clicked and re-evaluates", async () => {
    const user = userEvent.setup();
    vi.mocked(evaluateExecutiveDecisionsAction).mockResolvedValue({ success: true, data: makeResult() });
    vi.mocked(updateDecisionStatusAction).mockResolvedValue({ success: true, data: makeDecision({ status: "resolved" }) });

    render(<ExecutiveDashboardView />);
    await screen.findAllByText("77");

    const resolveButtons = screen.getAllByRole("button", { name: /mark.*resolved/i });
    await user.click(resolveButtons[0]);

    expect(updateDecisionStatusAction).toHaveBeenCalledWith("decision_1", "resolved", null);
    expect(evaluateExecutiveDecisionsAction).toHaveBeenCalledTimes(2);
  });

  it("lazily renders the full decision list only once expanded", async () => {
    const user = userEvent.setup();
    vi.mocked(evaluateExecutiveDecisionsAction).mockResolvedValue({ success: true, data: makeResult() });

    render(<ExecutiveDashboardView />);
    await screen.findAllByText("77");

    expect(screen.getByText("Expand to render the full list.")).toBeInTheDocument();

    const showButton = screen.getByRole("button", { name: "Show" });
    await user.click(showButton);
    expect(screen.queryByText("Expand to render the full list.")).not.toBeInTheDocument();
  });

  it("shows an empty state when the queue has no decisions", async () => {
    vi.mocked(evaluateExecutiveDecisionsAction).mockResolvedValue({ success: true, data: makeResult({ queue: [], allDecisions: [] }) });

    render(<ExecutiveDashboardView />);

    expect(await screen.findByText("The Executive Queue is empty")).toBeInTheDocument();
    expect(screen.getByText("No critical decisions.")).toBeInTheDocument();
  });
});
