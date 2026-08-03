import type { WorkflowTemplate } from "@/types/workflow";

/**
 * Step 7's own Template Registry — the same open `Map<id, definition>`
 * shape every registry in this codebase already uses
 * (`core/workflow/nodeRegistry.ts`, `core/automation/actionRegistry.ts`).
 * A future built-in Template needs only its own file plus one
 * `registerWorkflowTemplate()` call, never a change here.
 */
const templates = new Map<string, WorkflowTemplate>();

export function registerWorkflowTemplate(template: WorkflowTemplate): void {
  templates.set(template.id, template);
}

export function unregisterWorkflowTemplate(id: string): void {
  templates.delete(id);
}

export function getWorkflowTemplate(id: string): WorkflowTemplate | undefined {
  return templates.get(id);
}

/** Every registered Template, sorted alphabetically by name for a stable gallery order. */
export function listWorkflowTemplates(): WorkflowTemplate[] {
  return [...templates.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Test-only: restore the registry to empty between test cases. */
export function resetWorkflowTemplateRegistry(): void {
  templates.clear();
}
