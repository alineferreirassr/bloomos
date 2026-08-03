import { describe, expect, it } from "vitest";
import { aggregateWorkspaceHealth, bandForScore, type WorkspaceHealthInput } from "@/core/workspace/workspaceHealthEngine";

function baseInput(overrides: Partial<WorkspaceHealthInput> = {}): WorkspaceHealthInput {
  return {
    operationalHealthScore: 90,
    assetHealth: { score: 95, band: "excellent" },
    proposalHealthScores: [80, 90],
    contractHealthScores: [70],
    invoiceHealthScores: [60, 80],
    journeyHealthScores: [50],
    capabilityGaps: { uncoveredRequirementCount: 0, highRiskGapsCount: 0 },
    ...overrides,
  };
}

describe("workspaceHealthEngine.bandForScore", () => {
  it("maps score thresholds to bands", () => {
    expect(bandForScore(95)).toBe("excellent");
    expect(bandForScore(75)).toBe("good");
    expect(bandForScore(50)).toBe("attention");
    expect(bandForScore(10)).toBe("critical");
  });
});

describe("workspaceHealthEngine.aggregateWorkspaceHealth", () => {
  it("includes every platform entry with a computable score", () => {
    const summary = aggregateWorkspaceHealth("ws_1", baseInput(), "2026-01-01T00:00:00Z");
    const keys = summary.platforms.map((p) => p.key).sort();
    expect(keys).toEqual(["assets", "capability", "contracts", "invoices", "journeys", "operational", "proposals"]);
  });

  it("omits a platform whose score array is empty rather than averaging to NaN", () => {
    const summary = aggregateWorkspaceHealth("ws_1", baseInput({ proposalHealthScores: [] }), "2026-01-01T00:00:00Z");
    expect(summary.platforms.some((p) => p.key === "proposals")).toBe(false);
  });

  it("omits assets entirely when assetHealth is null", () => {
    const summary = aggregateWorkspaceHealth("ws_1", baseInput({ assetHealth: null }), "2026-01-01T00:00:00Z");
    expect(summary.platforms.some((p) => p.key === "assets")).toBe(false);
  });

  it("marks capability as a disclosed proxy, never a native score", () => {
    const summary = aggregateWorkspaceHealth("ws_1", baseInput(), "2026-01-01T00:00:00Z");
    const capability = summary.platforms.find((p) => p.key === "capability");
    expect(capability?.isProxy).toBe(true);
  });

  it("penalizes the capability proxy score for uncovered/high-risk gaps", () => {
    const clean = aggregateWorkspaceHealth("ws_1", baseInput(), "2026-01-01T00:00:00Z");
    const gappy = aggregateWorkspaceHealth("ws_1", baseInput({ capabilityGaps: { uncoveredRequirementCount: 4, highRiskGapsCount: 2 } }), "2026-01-01T00:00:00Z");

    const cleanScore = clean.platforms.find((p) => p.key === "capability")!.score;
    const gappyScore = gappy.platforms.find((p) => p.key === "capability")!.score;
    expect(gappyScore).toBeLessThan(cleanScore);
  });

  it("overallScore is the average of every included platform score", () => {
    const summary = aggregateWorkspaceHealth("ws_1", baseInput(), "2026-01-01T00:00:00Z");
    const expected = Math.round(summary.platforms.reduce((sum, p) => sum + p.score, 0) / summary.platforms.length);
    expect(summary.overallScore).toBe(expected);
  });
});
