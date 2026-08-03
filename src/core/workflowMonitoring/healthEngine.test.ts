import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { computeWorkflowHealthReport, computeWorkspaceWorkflowHealth } from "@/core/workflowMonitoring/healthEngine";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import type { Workflow, WorkflowEdge, WorkflowGraph, WorkflowNode } from "@/types/workflow";

function node(overrides: Partial<WorkflowNode> & Pick<WorkflowNode, "id" | "kind" | "nodeTypeId">): WorkflowNode {
  return { position: { x: 0, y: 0 }, label: overrides.id, data: {}, ...overrides };
}

function edge(overrides: Partial<WorkflowEdge> & Pick<WorkflowEdge, "id" | "sourceNodeId" | "targetNodeId">): WorkflowEdge {
  return { branch: null, ...overrides };
}

function validGraph(): WorkflowGraph {
  return {
    nodes: [
      node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
      node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
      node({ id: "n3", kind: "action", nodeTypeId: "action.create-memory" }),
      node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
    ],
    edges: [edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }), edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }), edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" })],
    variables: [],
  };
}

function stubWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    id: "wf_1",
    workspaceId: "ws_1",
    status: "published",
    metadata: { name: "Welcome Flow", description: "", category: "operations", tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph: validGraph(),
    currentVersion: 1,
    createdBy: "user_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

beforeAll(() => registerWorkflowNodes());

describe("computeWorkflowHealthReport", () => {
  it("scores 100 with no issues for a well-formed, used, published workflow", () => {
    const report = computeWorkflowHealthReport(stubWorkflow(), { usedWorkflowIds: new Set(["wf_1"]), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(report.score).toBe(100);
    expect(report.structuralIssues).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it("reuses validateWorkflow's own structural issues rather than re-detecting them", () => {
    const brokenGraph: WorkflowGraph = { nodes: [node({ id: "n1", kind: "start", nodeTypeId: "control.start" }), node({ id: "n2", kind: "end", nodeTypeId: "control.end" })], edges: [edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" })], variables: [] };
    const report = computeWorkflowHealthReport(stubWorkflow({ graph: brokenGraph }), { usedWorkflowIds: new Set(), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(report.structuralIssues.some((issue) => issue.code === "missing_trigger")).toBe(true);
    expect(report.score).toBeLessThan(100);
  });

  it("flags a Condition branch that never reaches an End node as a dead_branch finding", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
        node({ id: "n3", kind: "condition", nodeTypeId: "condition.role" }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-memory" }),
        node({ id: "n5", kind: "action", nodeTypeId: "action.create-memory" }),
        node({ id: "n6", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4", branch: "true" }),
        edge({ id: "e4", sourceNodeId: "n4", targetNodeId: "n6" }),
        // The "false" branch leads to n5, an Action with no further outgoing edge to End — dead.
        edge({ id: "e5", sourceNodeId: "n3", targetNodeId: "n5", branch: "false" }),
      ],
      variables: [],
    };
    const report = computeWorkflowHealthReport(stubWorkflow({ graph }), { usedWorkflowIds: new Set(), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(report.findings.some((finding) => finding.code === "dead_branch")).toBe(true);
  });

  it("flags two Action nodes with the same type and configuration as duplicated_action", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
        node({ id: "n3", kind: "action", nodeTypeId: "action.create-memory", data: { note: "same" } }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-memory", data: { note: "same" } }),
        node({ id: "n5", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }), edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }), edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }), edge({ id: "e4", sourceNodeId: "n4", targetNodeId: "n5" })],
      variables: [],
    };
    const report = computeWorkflowHealthReport(stubWorkflow({ graph }), { usedWorkflowIds: new Set(), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(report.findings.some((finding) => finding.code === "duplicated_action")).toBe(true);
  });

  it("flags a published Workflow that has never executed as unused_workflow", () => {
    const report = computeWorkflowHealthReport(stubWorkflow({ status: "published" }), { usedWorkflowIds: new Set(), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(report.findings.some((finding) => finding.code === "unused_workflow")).toBe(true);
  });

  it("never flags a draft Workflow as unused — that check only applies to published ones", () => {
    const report = computeWorkflowHealthReport(stubWorkflow({ status: "draft" }), { usedWorkflowIds: new Set(), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(report.findings.some((finding) => finding.code === "unused_workflow")).toBe(false);
  });

  it("flags a Workflow gated behind a currently-off feature flag as disabled_workflow", () => {
    const report = computeWorkflowHealthReport(stubWorkflow(), { usedWorkflowIds: new Set(["wf_1"]), disabledWorkflowIds: new Set(["wf_1"]) }, "2026-01-01T00:00:00.000Z");
    expect(report.findings.some((finding) => finding.code === "disabled_workflow")).toBe(true);
  });

  it("flags an archived Workflow as archived_workflow", () => {
    const report = computeWorkflowHealthReport(stubWorkflow({ status: "archived" }), { usedWorkflowIds: new Set(["wf_1"]), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(report.findings.some((finding) => finding.code === "archived_workflow")).toBe(true);
  });
});

describe("computeWorkspaceWorkflowHealth", () => {
  it("returns an honest null average score for a workspace with zero workflows", () => {
    const summary = computeWorkspaceWorkflowHealth([], { usedWorkflowIds: new Set(), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(summary.averageScore).toBeNull();
    expect(summary.reports).toEqual([]);
  });

  it("averages the score across every workflow report", () => {
    const perfect = stubWorkflow({ id: "wf_perfect" });
    const archived = stubWorkflow({ id: "wf_archived", status: "archived" });
    const summary = computeWorkspaceWorkflowHealth([perfect, archived], { usedWorkflowIds: new Set(["wf_perfect", "wf_archived"]), disabledWorkflowIds: new Set() }, "2026-01-01T00:00:00.000Z");
    expect(summary.reports).toHaveLength(2);
    expect(summary.averageScore).toBeLessThan(100);
    expect(summary.averageScore).toBeGreaterThan(0);
  });
});
