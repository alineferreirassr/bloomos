import type { WorkflowNodeDefinition } from "@/types/workflow";

/**
 * The two purely-structural node types (Step 2) — every Workflow's graph
 * has exactly one Start and any number of End nodes. Neither has real
 * configuration (`data` stays empty), and neither has a `compileTarget` —
 * the Compiler (Step 4) reads their *position in the graph*, never anything
 * stored on the node itself.
 */
export const startNode: WorkflowNodeDefinition = {
  id: "control.start",
  kind: "start",
  category: "control",
  name: "Start",
  description: "The single entry point of a Workflow — every graph has exactly one.",
  icon: "Play",
  color: "neutral",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  compileTarget: null,
};

export const endNode: WorkflowNodeDefinition = {
  id: "control.end",
  kind: "end",
  category: "control",
  name: "End",
  description: "Marks one path through the Workflow as complete. A Workflow may have more than one.",
  icon: "Flag",
  color: "neutral",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  compileTarget: null,
};

export const controlNodes: WorkflowNodeDefinition[] = [startNode, endNode];
