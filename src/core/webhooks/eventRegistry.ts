import type { WebhookEventCategory, WebhookEventDefinition, WebhookEventType } from "@/types/webhookEvent";

/**
 * Checkpoint 17, Step 1 — the Webhooks Platform's own event registry,
 * the exact same `Map`-based, class-free shape every other registry in
 * this codebase already uses (`core/ai/skills/registry.ts`,
 * `core/automation/registry.ts`, `core/workflow/nodeRegistry.ts`,
 * `core/analytics/metricRegistry.ts`). Every built-in event self-registers
 * from its own category file under `modules/webhooks/events/`, loaded
 * once via `registerBuiltinWebhookEvents()` — never populated by hand at
 * a call site.
 */
const registry = new Map<WebhookEventType, WebhookEventDefinition>();

export function registerWebhookEvent(definition: WebhookEventDefinition): void {
  registry.set(definition.type, definition);
}

export function unregisterWebhookEvent(type: WebhookEventType): void {
  registry.delete(type);
}

export function getWebhookEvent(type: WebhookEventType): WebhookEventDefinition | undefined {
  return registry.get(type);
}

export function listWebhookEvents(): WebhookEventDefinition[] {
  return [...registry.values()];
}

export function listWebhookEventsByCategory(category: WebhookEventCategory): WebhookEventDefinition[] {
  return listWebhookEvents().filter((definition) => definition.category === category);
}

export function resetWebhookEventRegistry(): void {
  registry.clear();
}
