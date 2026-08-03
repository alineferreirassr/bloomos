import { analyzeWorkflowGraph, type WorkflowAdjacencyEntry } from "@/core/workflow/graphAnalysis";
import { getWorkflowNode } from "@/core/workflow/nodeRegistry";
import { getLogger } from "@/core/observability/logger";
import type { AutomationCondition, AutomationConditionOperator, AutomationDefinition, AutomationTriggerType } from "@/types/automation";
import {
  DYNAMIC_CONDITION_EXISTS_TARGET,
  DYNAMIC_CONDITION_FIELD_TARGET,
  DYNAMIC_CONDITION_SWITCH_TARGET,
  type WorkflowCompilationResult,
  type WorkflowExecutionPolicy,
  type WorkflowGraph,
  type WorkflowMetadata,
  type WorkflowNode,
} from "@/types/workflow";

/**
 * Every `AutomationConditionOperator`'s own logical negation — a total,
 * self-inverse map over all eight operators. Used to compile a Condition
 * node's `"false"` branch: the same field/value, with the operator flipped,
 * so two Automations compiled from opposite branches of one Condition node
 * are mutually exclusive and jointly exhaustive over that one condition.
 */
const OPERATOR_NEGATION: Record<AutomationConditionOperator, AutomationConditionOperator> = {
  eq: "neq",
  neq: "eq",
  gt: "lte",
  lte: "gt",
  gte: "lt",
  lt: "gte",
  in: "notIn",
  notIn: "in",
};

export interface CompiledPath {
  triggerNode: WorkflowNode;
  conditions: AutomationCondition[];
  actionIds: string[];
  approvalPolicy: AutomationDefinition["approvalPolicy"];
  pathNodeIds: string[];
}

/**
 * Checkpoint 13's own generic Condition nodes (If/Compare/Exists/Switch)
 * carry no fixed field in `compileTarget` — each is registered with one of
 * three reserved sentinels instead (`types/workflow.ts`), and the field
 * they actually branch on lives per-instance in `node.data.field`. Every
 * one of Checkpoint 10's own 6 fixed Condition nodes still falls straight
 * through to the original path below, completely unchanged.
 */
export function conditionFromNode(node: WorkflowNode, branch: "true" | "false"): AutomationCondition | null {
  const definition = getWorkflowNode(node.nodeTypeId);
  if (!definition?.compileTarget) return null;
  const target = definition.compileTarget;

  if (target === DYNAMIC_CONDITION_EXISTS_TARGET) {
    const field = node.data.field;
    if (typeof field !== "string") return null;
    return { field: field as AutomationCondition["field"], operator: branch === "true" ? "neq" : "eq", value: "" };
  }

  if (target === DYNAMIC_CONDITION_SWITCH_TARGET) {
    const field = node.data.field;
    const rawCases = node.data.cases;
    if (typeof field !== "string" || typeof rawCases !== "string") return null;
    const cases = rawCases
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    if (cases.length === 0) return null;
    return { field: field as AutomationCondition["field"], operator: branch === "true" ? "in" : "notIn", value: cases };
  }

  const field = target === DYNAMIC_CONDITION_FIELD_TARGET ? node.data.field : target;
  if (typeof field !== "string") return null;
  const operator = node.data.operator;
  const value = node.data.value;
  if (typeof operator !== "string" || value === null || value === undefined) return null;
  const resolvedOperator = branch === "true" ? (operator as AutomationConditionOperator) : OPERATOR_NEGATION[operator as AutomationConditionOperator];
  return {
    field: field as AutomationCondition["field"],
    operator: resolvedOperator,
    value: value as AutomationCondition["value"],
  };
}

function approvalPolicyFromNode(node: WorkflowNode): AutomationDefinition["approvalPolicy"] | null {
  const definition = getWorkflowNode(node.nodeTypeId);
  if (!definition?.compileTarget) return null;
  const kind = definition.compileTarget as AutomationDefinition["approvalPolicy"]["kind"];
  if (kind === "role_restricted") {
    const minimumApproverRole = node.data.minimumApproverRole;
    return { kind, minimumApproverRole: typeof minimumApproverRole === "string" ? (minimumApproverRole as never) : null };
  }
  return { kind };
}

/**
 * Enumerates every simple path from one Trigger node to a terminal node
 * (an `end` node, or any node with no further valid outgoing edge) —
 * `analyzeWorkflowGraph` has already proven the graph is cycle-free, so this
 * always terminates. Each distinct path becomes its own compiled
 * `CompiledPath`; a Condition node contributes one `AutomationCondition`
 * per path depending on which branch that path took, so two paths that
 * diverge at the same Condition node compile to two mutually-exclusive
 * Automations rather than one Automation the Engine has no way to branch
 * inside of (branching is a Workflow Builder concept — the Engine itself
 * only ever runs a flat condition list, per Checkpoint 9's own design).
 */
export function enumeratePaths(triggerNode: WorkflowNode, adjacency: Map<string, WorkflowAdjacencyEntry[]>, nodesById: Map<string, WorkflowNode>): CompiledPath[] {
  const paths: CompiledPath[] = [];

  function walk(node: WorkflowNode, conditions: AutomationCondition[], actionIds: string[], approvalPolicy: AutomationDefinition["approvalPolicy"] | null, pathNodeIds: string[]): void {
    const nextPathNodeIds = [...pathNodeIds, node.id];
    const entries = adjacency.get(node.id) ?? [];

    if (node.kind === "end" || entries.length === 0) {
      paths.push({ triggerNode, conditions, actionIds, approvalPolicy: approvalPolicy ?? { kind: "never_required" }, pathNodeIds: nextPathNodeIds });
      return;
    }

    for (const { targetId, edge } of entries) {
      const targetNode = nodesById.get(targetId);
      if (!targetNode) continue;

      let nextConditions = conditions;
      let nextActionIds = actionIds;
      let nextApprovalPolicy = approvalPolicy;

      if (node.kind === "condition" && edge.branch) {
        const condition = conditionFromNode(node, edge.branch);
        if (condition) nextConditions = [...conditions, condition];
      }
      if (node.kind === "action") {
        const definition = getWorkflowNode(node.nodeTypeId);
        if (definition?.compileTarget) nextActionIds = [...actionIds, definition.compileTarget];
      }
      if (node.kind === "approval" && approvalPolicy === null) {
        nextApprovalPolicy = approvalPolicyFromNode(node);
      }

      walk(targetNode, nextConditions, nextActionIds, nextApprovalPolicy, nextPathNodeIds);
    }
  }

  walk(triggerNode, [], [], null, []);
  return paths;
}

export interface CompileWorkflowParams {
  workflowId: string;
  version: number;
  graph: WorkflowGraph;
  metadata: WorkflowMetadata;
  executionPolicy: WorkflowExecutionPolicy;
}

/**
 * The Step 4 Workflow Compiler — the only path from a Visual Graph to real
 * `AutomationDefinition`s. Deterministic: the same graph, metadata, and
 * execution policy always produce the same Automation Definitions, in the
 * same order (path enumeration walks `graph.edges` in their own stable
 * array order). Refuses to compile a structurally unsound graph outright —
 * `analyzeWorkflowGraph`'s own issues are returned as-is, and **nothing** is
 * produced, matching "Compilation must be deterministic" and this file's
 * own responsibility boundary: the Compiler never decides whether a
 * *structurally valid* graph is *ready to publish* — that's the Validation
 * Engine's job (Step 5), run separately, before this is ever called.
 */
export function compileWorkflow(params: CompileWorkflowParams): WorkflowCompilationResult {
  const started = Date.now();
  const analysis = analyzeWorkflowGraph(params.graph);
  if (analysis.issues.length > 0) {
    getLogger().warn("Workflow compile blocked by structural issues", {
      workflowId: params.workflowId,
      version: params.version,
      issueCount: analysis.issues.length,
      nodeCount: params.graph.nodes.length,
      durationMs: Date.now() - started,
    });
    return { success: false, issues: analysis.issues };
  }

  const nodesById = new Map(params.graph.nodes.map((node) => [node.id, node]));
  const triggerNodes = params.graph.nodes.filter(
    (node) => node.kind === "trigger" && analysis.startNode !== null && analysis.reachableNodeIds.has(node.id),
  );

  const automations: AutomationDefinition[] = [];
  for (const triggerNode of triggerNodes) {
    const paths = enumeratePaths(triggerNode, analysis.adjacency, nodesById);
    paths.forEach((path, pathIndex) => {
      const triggerDefinition = getWorkflowNode(triggerNode.nodeTypeId);
      if (!triggerDefinition?.compileTarget) return;

      // v2.0 Checkpoint 39 — the one generic "Timeline Event" trigger node
      // (`trigger.timeline-event`) carries which specific real Timeline
      // activity type it means in its own `data.activityType`, never in
      // `compileTarget` (every node instance shares the same
      // `"timeline_event"` compileTarget). Prepending an `activityType`
      // condition here — the same generic field the Condition Engine
      // already reads from `trigger.facts` (see `conditions.ts`) — is what
      // turns "fires on literally any Timeline activity" into "fires on
      // exactly the one this Workflow author picked."
      const activityTypeCondition: AutomationCondition[] =
        triggerDefinition.compileTarget === "timeline_event" && typeof triggerNode.data.activityType === "string" && triggerNode.data.activityType.length > 0
          ? [{ field: "activityType", operator: "eq", value: triggerNode.data.activityType }]
          : [];

      automations.push({
        id: `workflow-${params.workflowId}-trigger-${triggerNode.id}-path-${pathIndex}`,
        name: paths.length > 1 ? `${params.metadata.name} (Path ${pathIndex + 1})` : params.metadata.name,
        description: params.metadata.description,
        category: params.metadata.category,
        version: `workflow-${params.workflowId}-v${params.version}`,
        status: "active",
        trigger: triggerDefinition.compileTarget as AutomationTriggerType,
        conditions: [...activityTypeCondition, ...path.conditions],
        actionIds: path.actionIds,
        approvalPolicy: path.approvalPolicy,
        requiredPermissions: params.executionPolicy.requiredPermissions,
        featureFlag: params.executionPolicy.featureFlag,
        minimumRole: params.executionPolicy.minimumRole,
        maxRetries: params.executionPolicy.maxRetries,
        metadata: { workflowId: params.workflowId, workflowVersion: params.version, sourceNodeIds: path.pathNodeIds },
        workflow: params.executionPolicy.scheduledExecution ? { scheduledExecution: params.executionPolicy.scheduledExecution } : null,
      });
    });
  }

  getLogger().info("Workflow compiled", {
    workflowId: params.workflowId,
    version: params.version,
    automationCount: automations.length,
    nodeCount: params.graph.nodes.length,
    triggerCount: triggerNodes.length,
    durationMs: Date.now() - started,
  });
  return { success: true, automations };
}
