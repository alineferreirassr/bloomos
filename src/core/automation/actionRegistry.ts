import type { AutomationActionDefinition, AutomationCategory } from "@/types/automation";

/**
 * The Step 6 Action Registry — the same Map-based shape as
 * `core/automation/registry.ts` and `core/ai/skills/registry.ts`. Deliberately
 * separate from the Automation Registry: Actions are the open, extensible
 * side of this domain ("Future actions should register automatically,"
 * "No hardcoded actions" — Steps 5/6's own wording, never said about
 * Triggers), so they get their own registry a future module can add to
 * without touching `core/automation/registry.ts` at all.
 */
const actions = new Map<string, AutomationActionDefinition>();

export function registerAutomationAction(definition: AutomationActionDefinition): void {
  actions.set(definition.id, definition);
}

export function unregisterAutomationAction(id: string): void {
  actions.delete(id);
}

export function getAutomationAction(id: string): AutomationActionDefinition | undefined {
  return actions.get(id);
}

export function listAutomationActions(): AutomationActionDefinition[] {
  return [...actions.values()];
}

export function listAutomationActionsByCategory(category: AutomationCategory): AutomationActionDefinition[] {
  return listAutomationActions().filter((action) => action.category === category);
}

/** Test-only: restore the registry to empty between test cases. */
export function resetAutomationActionRegistry(): void {
  actions.clear();
}
