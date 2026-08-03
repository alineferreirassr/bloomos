import type { AutomationCategory, AutomationDefinition, AutomationTriggerType } from "@/types/automation";

/**
 * One Map keyed by Automation `id`, matching every other registry in this
 * codebase (`core/ai/skills/registry.ts`, `core/ai/providerRegistry.ts`,
 * `core/search/registry.ts`). Registering an `id` already in use replaces
 * that entry — each automation's own `registerXAutomation()` call site
 * guarantees "registration happens exactly once" (the same module-level
 * `let registered = false` guard every Skill registration already uses),
 * not this Map rejecting a second call.
 */
const automations = new Map<string, AutomationDefinition>();

export function registerAutomation(definition: AutomationDefinition): void {
  automations.set(definition.id, definition);
}

export function unregisterAutomation(id: string): void {
  automations.delete(id);
}

export function getAutomation(id: string): AutomationDefinition | undefined {
  return automations.get(id);
}

/** Every registered Automation, in registration order — callers needing a stable display order should sort explicitly, since Map iteration order is an implementation detail. */
export function listAutomations(): AutomationDefinition[] {
  return [...automations.values()];
}

export function listAutomationsByCategory(category: AutomationCategory): AutomationDefinition[] {
  return listAutomations().filter((automation) => automation.category === category);
}

/** Every **active** Automation registered against a given trigger type — the fan-out `dispatchAutomationTrigger` reads to decide what a real trigger event should run. A `"disabled"` Automation is still discoverable via `listAutomations()`, just never dispatched. */
export function listAutomationsForTrigger(trigger: AutomationTriggerType): AutomationDefinition[] {
  return listAutomations().filter((automation) => automation.trigger === trigger && automation.status === "active");
}

/** Test-only: restore the registry to empty between test cases. */
export function resetAutomationRegistry(): void {
  automations.clear();
}
