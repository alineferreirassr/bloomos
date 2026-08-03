import { describe, expect, it } from "vitest";
import { computeBusinessHealth, type ComputeBusinessHealthInput } from "@/core/knowledge/businessHealthEngine";
import type { KnowledgeHealthReport } from "@/core/knowledge/knowledgeHealthEngine";
import type { WorkspaceHealthReport, CompletenessResult } from "@/types/businessHealth";

const NOW = "2026-07-30T00:00:00.000Z";

function makeKnowledgeHealth(overrides: Partial<KnowledgeHealthReport> = {}): KnowledgeHealthReport {
  return {
    brokenRelationships: [],
    orphanedAssets: [],
    duplicateRelationshipGroups: [],
    circularReferenceGroups: [],
    constraintViolations: [],
    notApplicable: ["unused_templates", "expired_assets"],
    ...overrides,
  };
}

function makeWorkspaceHealth(overrides: Partial<WorkspaceHealthReport> = {}): WorkspaceHealthReport {
  return {
    assetsWithoutOwners: 0,
    brokenRelationships: 0,
    missingRequiredRelationships: 0,
    invalidConstraints: 0,
    expiredDocuments: 0,
    archivedAssetsStillReferenced: 0,
    duplicateRelationshipGroups: 0,
    unusedTemplates: 0,
    incompleteProposals: 0,
    incompleteEvents: 0,
    overdueApprovals: 0,
    pendingDependencies: 0,
    ...overrides,
  };
}

function baseInput(overrides: Partial<ComputeBusinessHealthInput> = {}): ComputeBusinessHealthInput {
  return {
    knowledgeHealth: makeKnowledgeHealth(),
    workspaceHealth: makeWorkspaceHealth(),
    totalRelationships: 0,
    totalNodesValidated: 0,
    totalAssets: 0,
    totalDocuments: 0,
    proposalCompleteness: [],
    clientCompleteness: [],
    eventCompleteness: [],
    vendorCompleteness: [],
    evaluatedAt: NOW,
    ...overrides,
  };
}

describe("computeBusinessHealth", () => {
  it("marks every ratio/completeness category notApplicable when the workspace has no data at all", () => {
    const report = computeBusinessHealth(baseInput());
    const byCategory = new Map(report.categories.map((c) => [c.category, c]));
    expect(byCategory.get("relationship_health")?.notApplicableReason).toBe("No relationships recorded yet.");
    expect(byCategory.get("asset_health")?.notApplicableReason).toBe("No assets recorded yet.");
    expect(byCategory.get("proposal_completeness")?.notApplicableReason).toBe("No proposals to evaluate yet.");
  });

  it("marks communication_health notApplicable — Checkpoint 24's Communication Platform is never wired into this computation", () => {
    const report = computeBusinessHealth(baseInput());
    const byCategory = new Map(report.categories.map((c) => [c.category, c]));
    expect(byCategory.get("communication_health")?.score).toBeNull();
  });

  it("marks workflow_readiness notApplicable when no workflowHealth is supplied — the exact pre-Checkpoint-39 behavior every caller without it keeps getting", () => {
    const report = computeBusinessHealth(baseInput());
    const byCategory = new Map(report.categories.map((c) => [c.category, c]));
    expect(byCategory.get("workflow_readiness")?.score).toBeNull();
    expect(byCategory.get("workflow_readiness")?.notApplicableReason).toContain("Checkpoint 39");
  });

  it("v2.0 Checkpoint 39 — scores workflow_readiness for real from a supplied WorkspaceWorkflowHealthSummary, never recomputing it", () => {
    const workflowHealth = {
      reports: [
        {
          workflowId: "wf_1",
          workflowName: "Welcome Flow",
          status: "published" as const,
          structuralIssues: [{ code: "missing_action" as const, message: "No Action node is reachable.", nodeId: null, edgeId: null }],
          findings: [],
          score: 85,
          evaluatedAt: NOW,
        },
      ],
      averageScore: 85,
      totalFindings: 1,
      evaluatedAt: NOW,
    };
    const report = computeBusinessHealth(baseInput({ workflowHealth }));
    const category = report.categories.find((c) => c.category === "workflow_readiness");
    expect(category?.score).toBe(85);
    expect(category?.notApplicableReason).toBeNull();
    expect(category?.issues).toContain("No Action node is reachable.");
  });

  it("scores relationship_health as a ratio of clean vs. broken/duplicate/circular relationships", () => {
    const knowledgeHealth = makeKnowledgeHealth({ brokenRelationships: [{} as never] });
    const report = computeBusinessHealth(baseInput({ knowledgeHealth, totalRelationships: 4 }));
    const category = report.categories.find((c) => c.category === "relationship_health");
    expect(category?.score).toBe(75);
    expect(category?.issues).toEqual(["1 broken relationship(s)"]);
  });

  it("averages CompletenessResult scores for proposal_completeness and surfaces missing requirements as issues", () => {
    const proposalCompleteness: CompletenessResult[] = [{ missingRequirements: ["Missing Hero Image"], score: 80 }, { missingRequirements: [], score: 100 }];
    const report = computeBusinessHealth(baseInput({ proposalCompleteness }));
    const category = report.categories.find((c) => c.category === "proposal_completeness");
    expect(category?.score).toBe(90);
    expect(category?.issues).toEqual(["Missing Hero Image"]);
  });

  it("weights dependency_health's penalty by count, not by distinct issue message (no ratio denominator available)", () => {
    const workspaceHealth = makeWorkspaceHealth({ missingRequiredRelationships: 2, pendingDependencies: 1 });
    const report = computeBusinessHealth(baseInput({ workspaceHealth }));
    const category = report.categories.find((c) => c.category === "dependency_health");
    expect(category?.score).toBe(75);
    expect(category?.notApplicableReason).toBeNull();
  });

  it("averages only the non-null category scores into overallScore", () => {
    const report = computeBusinessHealth(baseInput({ totalRelationships: 2, totalNodesValidated: 2 }));
    const scored = report.categories.filter((c) => c.score !== null);
    const expected = Math.round(scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length);
    expect(report.overallScore).toBe(expected);
  });

  it("falls back to dependency_health alone (the only category with no notApplicable path) when the workspace has no other data", () => {
    const report = computeBusinessHealth(baseInput());
    const scored = report.categories.filter((c) => c.score !== null);
    expect(scored.map((c) => c.category)).toEqual(["dependency_health"]);
    expect(report.overallScore).toBe(100);
  });

  it("returns overallScore 0 only in the extreme case where the scored category itself hits zero", () => {
    const workspaceHealth = makeWorkspaceHealth({ missingRequiredRelationships: 10 });
    const report = computeBusinessHealth(baseInput({ workspaceHealth }));
    expect(report.overallScore).toBe(0);
  });

  it("passes evaluatedAt straight through", () => {
    const report = computeBusinessHealth(baseInput());
    expect(report.evaluatedAt).toBe(NOW);
  });
});
