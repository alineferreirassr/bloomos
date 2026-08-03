import type { AutomationDefinition, AutomationTriggerType } from "@/types/automation";
import type { Workflow } from "@/types/workflow";
import type { WorkflowDependencyMap, WorkflowTriggerEdge } from "@/types/workflowMonitoring";

/**
 * v2.0 Checkpoint 39 FINAL ADDENDUM — Workflow Dependency Map. The only
 * Automation Action id that's actually, statically derivable as producing
 * a real trigger is `"create-event"` (`createEventAction.ts` calls the
 * real `createEvent()` in `lib/data/index.ts`, which is the one call site
 * that dispatches `"event.created"` among the 11 new Checkpoint 39
 * Actions — confirmed by reading every one of their own `lib/data`
 * imports). Every other new action either calls a domain function that
 * dispatches no trigger, or calls nothing from `lib/data` at all. This map
 * is intentionally this narrow rather than guessed wider — a fabricated
 * edge would be worse than an honestly incomplete one.
 */
const ACTION_ID_PRODUCES_TRIGGER: Partial<Record<string, AutomationTriggerType>> = {
  "create-event": "event.created",
};

interface CompiledWorkflowRef {
  workflowId: string;
  workflowName: string;
}

function compiledWorkflowRef(automation: AutomationDefinition): CompiledWorkflowRef | null {
  const workflowId = automation.metadata?.workflowId;
  if (typeof workflowId !== "string") return null;
  return { workflowId, workflowName: automation.name };
}

function findCircularChains(edges: WorkflowTriggerEdge[]): string[][] {
  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.sourceWorkflowId) ?? new Set<string>();
    for (const targetId of edge.targetWorkflowIds) targets.add(targetId);
    adjacency.set(edge.sourceWorkflowId, targets);
  }

  const chains: string[][] = [];
  const seenChainKeys = new Set<string>();

  function dfs(startId: string, currentId: string, path: string[], visited: Set<string>): void {
    for (const nextId of adjacency.get(currentId) ?? []) {
      if (nextId === startId && path.length > 0) {
        const key = [...path].sort().join(">");
        if (!seenChainKeys.has(key)) {
          seenChainKeys.add(key);
          chains.push([...path]);
        }
        continue;
      }
      if (visited.has(nextId)) continue;
      dfs(startId, nextId, [...path, nextId], new Set(visited).add(nextId));
    }
  }

  for (const startId of adjacency.keys()) dfs(startId, startId, [startId], new Set([startId]));
  return chains;
}

export function computeWorkflowDependencyMap(automations: AutomationDefinition[], workflows: Workflow[], evaluatedAt: string): WorkflowDependencyMap {
  const workflowNameById = new Map(workflows.map((workflow) => [workflow.id, workflow.metadata.name]));

  const triggerGraph: Partial<Record<AutomationTriggerType, string[]>> = {};
  const actionGraph: Record<string, string[]> = {};

  for (const automation of automations) {
    const ref = compiledWorkflowRef(automation);
    if (!ref) continue;
    const listeners = triggerGraph[automation.trigger] ?? [];
    if (!listeners.includes(ref.workflowId)) listeners.push(ref.workflowId);
    triggerGraph[automation.trigger] = listeners;

    const actions = actionGraph[ref.workflowId] ?? [];
    actionGraph[ref.workflowId] = [...new Set([...actions, ...automation.actionIds])];
  }

  const workflowsTriggeringWorkflows: WorkflowTriggerEdge[] = [];
  for (const automation of automations) {
    const source = compiledWorkflowRef(automation);
    if (!source) continue;
    for (const actionId of automation.actionIds) {
      const producedTrigger = ACTION_ID_PRODUCES_TRIGGER[actionId];
      if (!producedTrigger) continue;
      const targetWorkflowIds = triggerGraph[producedTrigger] ?? [];
      if (targetWorkflowIds.length === 0) continue;
      workflowsTriggeringWorkflows.push({
        sourceWorkflowId: source.workflowId,
        sourceWorkflowName: workflowNameById.get(source.workflowId) ?? source.workflowName,
        producedTrigger,
        targetWorkflowIds,
      });
    }
  }

  return {
    triggerGraph,
    actionGraph,
    workflowsTriggeringWorkflows,
    circularChains: findCircularChains(workflowsTriggeringWorkflows),
    evaluatedAt,
  };
}
