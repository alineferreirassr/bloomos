import type { WorkflowNodeCategory, WorkflowNodeDefinition } from "@/types/workflow";

/**
 * The Step 3 Node Registry — the same `Map<id, definition>` shape every
 * registry in this codebase already uses (`core/automation/actionRegistry.ts`,
 * `core/ai/skills/registry.ts`). Deliberately open (unlike `WorkflowNodeKind`,
 * see that type's own doc comment): "Future node types must register
 * automatically" (Step 2) and "No hardcoded node rendering" (Step 3) are
 * this file's own literal wording — the Node Library panel and the
 * NodeRenderer both read this catalog exclusively, never a hand-maintained
 * switch statement keyed on a node's own id.
 */
const nodeDefinitions = new Map<string, WorkflowNodeDefinition>();

export function registerWorkflowNode(definition: WorkflowNodeDefinition): void {
  nodeDefinitions.set(definition.id, definition);
}

export function unregisterWorkflowNode(id: string): void {
  nodeDefinitions.delete(id);
}

export function getWorkflowNode(id: string): WorkflowNodeDefinition | undefined {
  return nodeDefinitions.get(id);
}

/** Every registered node type, in registration order — callers needing a stable display order should sort explicitly, since Map iteration order is an implementation detail. */
export function listWorkflowNodes(): WorkflowNodeDefinition[] {
  return [...nodeDefinitions.values()];
}

export function listWorkflowNodesByCategory(category: WorkflowNodeCategory): WorkflowNodeDefinition[] {
  return listWorkflowNodes().filter((definition) => definition.category === category);
}

/** Test-only: restore the registry to empty between test cases. */
export function resetWorkflowNodeRegistry(): void {
  nodeDefinitions.clear();
}
