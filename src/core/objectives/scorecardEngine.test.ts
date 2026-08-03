import { describe, expect, it } from "vitest";
import { computeWorkspaceScorecard } from "@/core/objectives/scorecardEngine";
import type { ObjectiveProgress } from "@/types/objectives";

const NOW = "2026-07-30T00:00:00.000Z";

function progress(id: string, completionPercent: number): ObjectiveProgress {
  return { objectiveId: id, completionPercent, missingRequirements: [], blockingIssues: [], remainingTasks: [], estimatedProgress: completionPercent };
}

describe("computeWorkspaceScorecard", () => {
  it("returns all-100 defaults for an empty workspace", () => {
    const scorecard = computeWorkspaceScorecard({ effectiveStatuses: new Map(), progresses: [], businessHealthOverallScore: 80, evaluatedAt: NOW });
    expect(scorecard.objectivesCompleted).toBe(0);
    expect(scorecard.averageCompletion).toBe(100);
    expect(scorecard.operationalProgress).toBe(100);
    expect(scorecard.businessReadiness).toBe(80);
  });

  it("counts completed/blocked/overdue from effectiveStatuses", () => {
    const effectiveStatuses = new Map<string, "completed" | "blocked" | "overdue" | "in_progress">([
      ["o1", "completed"],
      ["o2", "completed"],
      ["o3", "blocked"],
      ["o4", "overdue"],
      ["o5", "in_progress"],
    ]);
    const scorecard = computeWorkspaceScorecard({ effectiveStatuses, progresses: [], businessHealthOverallScore: 80, evaluatedAt: NOW });
    expect(scorecard.objectivesCompleted).toBe(2);
    expect(scorecard.objectivesBlocked).toBe(1);
    expect(scorecard.objectivesOverdue).toBe(1);
  });

  it("computes averageCompletion as the mean completion % across all objectives", () => {
    const scorecard = computeWorkspaceScorecard({ effectiveStatuses: new Map(), progresses: [progress("o1", 100), progress("o2", 50), progress("o3", 0)], businessHealthOverallScore: 0, evaluatedAt: NOW });
    expect(scorecard.averageCompletion).toBe(50);
  });

  it("computes operationalProgress as the completion rate by count, distinct from averageCompletion", () => {
    const effectiveStatuses = new Map<string, "completed" | "in_progress">([
      ["o1", "completed"],
      ["o2", "in_progress"],
      ["o3", "in_progress"],
      ["o4", "in_progress"],
    ]);
    // Average completion across near-finished objectives is high, but only 1 of 4 has actually finished.
    const progresses = [progress("o1", 100), progress("o2", 90), progress("o3", 90), progress("o4", 90)];
    const scorecard = computeWorkspaceScorecard({ effectiveStatuses, progresses, businessHealthOverallScore: 0, evaluatedAt: NOW });
    expect(scorecard.averageCompletion).toBe(93);
    expect(scorecard.operationalProgress).toBe(25);
  });

  it("blends averageCompletion and businessReadiness into overallOperationalScore", () => {
    const scorecard = computeWorkspaceScorecard({ effectiveStatuses: new Map(), progresses: [progress("o1", 60)], businessHealthOverallScore: 80, evaluatedAt: NOW });
    expect(scorecard.overallOperationalScore).toBe(70);
  });

  it("passes evaluatedAt straight through", () => {
    expect(computeWorkspaceScorecard({ effectiveStatuses: new Map(), progresses: [], businessHealthOverallScore: 0, evaluatedAt: NOW }).evaluatedAt).toBe(NOW);
  });
});
