import type { ConnectorCategory, ConnectorDefinition } from "@/types/connector";

/**
 * Checkpoint 18, Step 1 — the Marketplace's own connector registry, the
 * exact same `Map`-based, class-free shape every other registry in this
 * codebase already uses (`core/webhooks/eventRegistry.ts`,
 * `core/analytics/metricRegistry.ts`, `core/ai/skills/registry.ts`,
 * `core/automation/registry.ts`, `core/workflow/nodeRegistry.ts`). Every
 * built-in connector self-registers from its own file under
 * `modules/marketplace/connectors/`, loaded once via
 * `registerBuiltinConnectors()` — never populated by hand at a call site.
 * Step 7's own "Developer Extensions" is this registry's openness itself:
 * any future connector — built-in or third-party — registers through
 * `registerConnector()`, the same single door every built-in one already
 * uses.
 */
const registry = new Map<string, ConnectorDefinition>();

export function registerConnector(definition: ConnectorDefinition): void {
  registry.set(definition.id, definition);
}

export function unregisterConnector(id: string): void {
  registry.delete(id);
}

export function getConnector(id: string): ConnectorDefinition | undefined {
  return registry.get(id);
}

export function listConnectors(): ConnectorDefinition[] {
  return [...registry.values()];
}

export function listConnectorsByCategory(category: ConnectorCategory): ConnectorDefinition[] {
  return listConnectors().filter((definition) => definition.category === category);
}

export function resetConnectorRegistry(): void {
  registry.clear();
}
