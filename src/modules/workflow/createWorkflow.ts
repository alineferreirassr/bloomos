"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerWorkflowNodes } from "@/modules/workflow/registerWorkflowNodes";
import { registerWorkflowTemplates } from "@/modules/workflow/registerWorkflowTemplates";
import { getWorkflowManager } from "@/core/workflow/manager";
import { getWorkflowNode } from "@/core/workflow/nodeRegistry";
import { getWorkflowTemplate } from "@/core/workflow/templateRegistry";
import type { AutomationCategory } from "@/types/automation";
import type { Workflow, WorkflowGraph } from "@/types/workflow";

const GENERIC_ACCESS_ERROR = "A new Workflow couldn't be created right now.";

registerWorkflowNodes();
registerWorkflowTemplates();

export type CreateWorkflowResult = { success: true; data: Workflow } | { success: false; error: string };

function buildInitialGraph(triggerNodeId: string | null): WorkflowGraph {
  const start = { id: "start", kind: "start" as const, nodeTypeId: "control.start", position: { x: 80, y: 200 }, label: "Start", data: {} };
  const triggerDefinition = triggerNodeId ? getWorkflowNode(triggerNodeId) : undefined;
  if (!triggerDefinition) return { nodes: [start], edges: [], variables: [] };

  const trigger = { id: "trigger", kind: "trigger" as const, nodeTypeId: triggerDefinition.id, position: { x: 380, y: 200 }, label: triggerDefinition.name, data: {} };
  return {
    nodes: [start, trigger],
    edges: [{ id: "start-trigger", sourceNodeId: "start", targetNodeId: "trigger", branch: null }],
    variables: [],
  };
}

/**
 * Creates a new draft Workflow with a Start node already placed — every
 * Workflow needs exactly one, so a brand-new one starts with it rather than
 * an empty canvas. `triggerNodeId` is optional — when a member accepts a
 * suggestion from `getWorkflowSuggestions.ts` (Step 12), it's passed
 * through here to pre-connect that Trigger too, but this function itself
 * never runs unprompted: it's still only ever called after an explicit
 * "Create Workflow" click, the human approval step Step 12 requires.
 *
 * `templateId` (Step 7) is the third, mutually-exclusive starting point: a
 * built-in Template's own `graph` is deep-cloned onto the new Workflow
 * instead of `buildInitialGraph`'s bare Start(+Trigger). Still only ever
 * runs after the same explicit "Create Workflow" click — a Template
 * pre-fills the canvas, it never publishes anything on its own.
 */
export async function createWorkflow(name: string, category: AutomationCategory, triggerNodeId: string | null = null, templateId: string | null = null): Promise<CreateWorkflowResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const trimmedName = name.trim();
  if (!trimmedName) return { success: false, error: "Give this Workflow a name." };

  const template = templateId ? getWorkflowTemplate(templateId) : undefined;
  const graph = template ? (JSON.parse(JSON.stringify(template.graph)) as WorkflowGraph) : buildInitialGraph(triggerNodeId);

  const result = await getWorkflowManager().createWorkflow(session.workspace.id, session.user.id, {
    metadata: { name: trimmedName, description: template?.description ?? "", category, tags: [] },
    executionPolicy: { requiredPermissions: [], minimumRole: null, featureFlag: null, maxRetries: 0, scheduledExecution: null },
    graph,
  });

  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}
