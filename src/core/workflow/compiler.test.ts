import { beforeAll, describe, expect, it, vi } from "vitest";

// `registerWorkflowNodes()` registers the built-in Action nodes, which
// import the real `modules/automation/actions/*.ts` files — including the
// four "Generate X" actions, each importing its own Skill wrapper, each of
// which calls `registerDefaultAIContextBuilders()` at module load, reaching
// `server-only`-guarded files this test never actually exercises. Same
// standard mock set every AI/Automation entry-point test in this codebase
// already uses for this exact reason (see Checkpoint 9's own precedent).
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { compileWorkflow } from "@/core/workflow/compiler";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import type { WorkflowEdge, WorkflowExecutionPolicy, WorkflowGraph, WorkflowMetadata, WorkflowNode } from "@/types/workflow";

function node(overrides: Partial<WorkflowNode> & Pick<WorkflowNode, "id" | "kind" | "nodeTypeId">): WorkflowNode {
  return { position: { x: 0, y: 0 }, label: overrides.id, data: {}, ...overrides };
}

function edge(overrides: Partial<WorkflowEdge> & Pick<WorkflowEdge, "id" | "sourceNodeId" | "targetNodeId">): WorkflowEdge {
  return { branch: null, ...overrides };
}

function metadata(overrides: Partial<WorkflowMetadata> = {}): WorkflowMetadata {
  return { name: "Test Workflow", description: "A workflow for compiler tests.", category: "operations", tags: [], ...overrides };
}

function executionPolicy(overrides: Partial<WorkflowExecutionPolicy> = {}): WorkflowExecutionPolicy {
  return { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null, ...overrides };
}

// `registerWorkflowNodes()` is idempotent, exactly like `registerAutomationDefinitions()`
// (Checkpoint 9) — called once here against the real, shared registry
// rather than reset per test, since this file exercises the Compiler's own
// behavior against the real built-in node catalog, not the registry's own
// register/reset mechanics (see `nodeRegistry.test.ts` for that).
beforeAll(() => registerWorkflowNodes());

describe("compileWorkflow", () => {
  it("returns structural issues and produces nothing when the graph is invalid", () => {
    const graph: WorkflowGraph = { nodes: [], edges: [], variables: [] };
    const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some((issue) => issue.code === "invalid_graph")).toBe(true);
    }
  });

  it("compiles a linear Trigger → Action → End graph into one AutomationDefinition", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
        node({ id: "n3", kind: "action", nodeTypeId: "action.create-memory" }),
        node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
      ],
      variables: [],
    };

    const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.automations).toHaveLength(1);
      expect(result.automations[0]).toMatchObject({
        trigger: "proposal.rejected",
        actionIds: ["create-memory"],
        conditions: [],
        approvalPolicy: { kind: "never_required" },
        status: "active",
      });
    }
  });

  it("compiles a branching Condition node into two mutually-exclusive Automations", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.invoice-overdue" }),
        node({ id: "n3", kind: "condition", nodeTypeId: "condition.days-overdue", data: { operator: "gte", value: 7 } }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-notification" }),
        node({ id: "n5", kind: "action", nodeTypeId: "action.create-task" }),
        node({ id: "n6", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4", branch: "true" }),
        edge({ id: "e4", sourceNodeId: "n3", targetNodeId: "n5", branch: "false" }),
        edge({ id: "e5", sourceNodeId: "n4", targetNodeId: "n6" }),
        edge({ id: "e6", sourceNodeId: "n5", targetNodeId: "n6" }),
      ],
      variables: [],
    };

    const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.automations).toHaveLength(2);
      const truePath = result.automations.find((automation) => automation.actionIds.includes("create-notification"));
      const falsePath = result.automations.find((automation) => automation.actionIds.includes("create-task"));
      expect(truePath?.conditions).toEqual([{ field: "daysOverdue", operator: "gte", value: 7 }]);
      expect(falsePath?.conditions).toEqual([{ field: "daysOverdue", operator: "lt", value: 7 }]);
    }
  });

  it("carries the first Approval node encountered along a path into that path's own approvalPolicy", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.proposal-rejected" }),
        node({ id: "n3", kind: "approval", nodeTypeId: "approval.manager", data: { minimumApproverRole: "manager" } }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-memory" }),
        node({ id: "n5", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
        edge({ id: "e4", sourceNodeId: "n4", targetNodeId: "n5" }),
      ],
      variables: [],
    };

    const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.automations[0].approvalPolicy).toEqual({ kind: "role_restricted", minimumApproverRole: "manager" });
    }
  });

  it("copies the Workflow's own execution policy onto every compiled Automation", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.memory-created" }),
        node({ id: "n3", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }), edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" })],
      variables: [],
    };
    const policy = executionPolicy({ requiredPermissions: ["events.update"], minimumRole: "manager", featureFlag: "workflow-x", maxRetries: 2 });

    const result = compileWorkflow({ workflowId: "wf_1", version: 3, graph, metadata: metadata(), executionPolicy: policy });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.automations[0]).toMatchObject({
        requiredPermissions: ["events.update"],
        minimumRole: "manager",
        featureFlag: "workflow-x",
        maxRetries: 2,
        version: "workflow-wf_1-v3",
      });
    }
  });

  it("is deterministic — compiling the identical graph twice produces identical output", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.contract-signed" }),
        node({ id: "n3", kind: "action", nodeTypeId: "action.create-task" }),
        node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
      ],
      variables: [],
    };

    const first = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
    const second = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
    expect(first).toEqual(second);
  });

  it("returns a cycle_detected issue for a graph with a back-edge, and produces nothing", () => {
    const graph: WorkflowGraph = {
      nodes: [
        node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
        node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.contract-signed" }),
        node({ id: "n3", kind: "action", nodeTypeId: "action.create-task" }),
        node({ id: "n4", kind: "action", nodeTypeId: "action.create-notification" }),
      ],
      edges: [
        edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
        edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
        edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
        edge({ id: "e4", sourceNodeId: "n4", targetNodeId: "n3" }),
      ],
      variables: [],
    };

    const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.some((issue) => issue.code === "cycle_detected")).toBe(true);
    }
  });

  describe("Checkpoint 13 — generic Condition nodes (If/Compare/Exists/Switch)", () => {
    it("condition.if resolves its field from node.data, not from compileTarget", () => {
      const graph: WorkflowGraph = {
        nodes: [
          node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
          node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.invoice-paid" }),
          node({ id: "n3", kind: "condition", nodeTypeId: "condition.if", data: { field: "invoiceAmountMinor", operator: "gt", value: 50000 } }),
          node({ id: "n4", kind: "action", nodeTypeId: "action.create-notification" }),
          node({ id: "n5", kind: "end", nodeTypeId: "control.end" }),
        ],
        edges: [
          edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
          edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
          edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4", branch: "true" }),
          edge({ id: "e4", sourceNodeId: "n4", targetNodeId: "n5" }),
        ],
        variables: [],
      };

      const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.automations[0].conditions).toEqual([{ field: "invoiceAmountMinor", operator: "gt", value: 50000 }]);
      }
    });

    it("condition.exists ignores node.data.operator/value, always compiling to neq \"\" / eq \"\"", () => {
      const graph: WorkflowGraph = {
        nodes: [
          node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
          node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.invoice-paid" }),
          node({ id: "n3", kind: "condition", nodeTypeId: "condition.exists", data: { field: "contractStatus" } }),
          node({ id: "n4", kind: "action", nodeTypeId: "action.create-notification" }),
          node({ id: "n5", kind: "action", nodeTypeId: "action.create-task" }),
          node({ id: "n6", kind: "end", nodeTypeId: "control.end" }),
        ],
        edges: [
          edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
          edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
          edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4", branch: "true" }),
          edge({ id: "e4", sourceNodeId: "n3", targetNodeId: "n5", branch: "false" }),
          edge({ id: "e5", sourceNodeId: "n4", targetNodeId: "n6" }),
          edge({ id: "e6", sourceNodeId: "n5", targetNodeId: "n6" }),
        ],
        variables: [],
      };

      const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
      expect(result.success).toBe(true);
      if (result.success) {
        const truePath = result.automations.find((automation) => automation.actionIds.includes("create-notification"));
        const falsePath = result.automations.find((automation) => automation.actionIds.includes("create-task"));
        expect(truePath?.conditions).toEqual([{ field: "contractStatus", operator: "neq", value: "" }]);
        expect(falsePath?.conditions).toEqual([{ field: "contractStatus", operator: "eq", value: "" }]);
      }
    });

    it("condition.switch splits data.cases on commas and compiles to in/notIn", () => {
      const graph: WorkflowGraph = {
        nodes: [
          node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
          node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.event-created" }),
          node({ id: "n3", kind: "condition", nodeTypeId: "condition.switch", data: { field: "eventType", cases: "wedding, gala , corporate" } }),
          node({ id: "n4", kind: "action", nodeTypeId: "action.create-notification" }),
          node({ id: "n5", kind: "action", nodeTypeId: "action.create-task" }),
          node({ id: "n6", kind: "end", nodeTypeId: "control.end" }),
        ],
        edges: [
          edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
          edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
          edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4", branch: "true" }),
          edge({ id: "e4", sourceNodeId: "n3", targetNodeId: "n5", branch: "false" }),
          edge({ id: "e5", sourceNodeId: "n4", targetNodeId: "n6" }),
          edge({ id: "e6", sourceNodeId: "n5", targetNodeId: "n6" }),
        ],
        variables: [],
      };

      const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
      expect(result.success).toBe(true);
      if (result.success) {
        const truePath = result.automations.find((automation) => automation.actionIds.includes("create-notification"));
        const falsePath = result.automations.find((automation) => automation.actionIds.includes("create-task"));
        expect(truePath?.conditions).toEqual([{ field: "eventType", operator: "in", value: ["wedding", "gala", "corporate"] }]);
        expect(falsePath?.conditions).toEqual([{ field: "eventType", operator: "notIn", value: ["wedding", "gala", "corporate"] }]);
      }
    });
  });

  describe("Checkpoint 13 — null-compileTarget Triggers (Manual, Timer)", () => {
    it("a Manual Trigger compiles the graph successfully but produces zero real Automations", () => {
      const graph: WorkflowGraph = {
        nodes: [
          node({ id: "n1", kind: "start", nodeTypeId: "control.start" }),
          node({ id: "n2", kind: "trigger", nodeTypeId: "trigger.manual" }),
          node({ id: "n3", kind: "action", nodeTypeId: "action.create-notification" }),
          node({ id: "n4", kind: "end", nodeTypeId: "control.end" }),
        ],
        edges: [
          edge({ id: "e1", sourceNodeId: "n1", targetNodeId: "n2" }),
          edge({ id: "e2", sourceNodeId: "n2", targetNodeId: "n3" }),
          edge({ id: "e3", sourceNodeId: "n3", targetNodeId: "n4" }),
        ],
        variables: [],
      };

      const result = compileWorkflow({ workflowId: "wf_1", version: 1, graph, metadata: metadata(), executionPolicy: executionPolicy() });
      expect(result.success).toBe(true);
      if (result.success) expect(result.automations).toHaveLength(0);
    });
  });
});
