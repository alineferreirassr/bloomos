import { describe, expect, it } from "vitest";
import { registerBuiltinWebhookEvents } from "@/modules/webhooks/registerBuiltinWebhookEvents";
import { listWebhookEvents, resetWebhookEventRegistry } from "@/core/webhooks/eventRegistry";
import { WEBHOOK_EVENT_TYPES } from "@/types/webhookEvent";

describe("registerBuiltinWebhookEvents", () => {
  it("registers all 17 catalog events with a real name/description/schema, and is idempotent across repeated calls", () => {
    resetWebhookEventRegistry();
    registerBuiltinWebhookEvents();
    registerBuiltinWebhookEvents(); // second call must be a no-op, not a duplicate registration

    const registered = listWebhookEvents();
    expect(registered).toHaveLength(WEBHOOK_EVENT_TYPES.length);

    const registeredTypes = new Set(registered.map((d) => d.type));
    for (const type of WEBHOOK_EVENT_TYPES) {
      expect(registeredTypes.has(type), `missing ${type}`).toBe(true);
    }
    for (const definition of registered) {
      expect(definition.name.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.version).toBeGreaterThanOrEqual(1);
      expect(definition.payloadSchema).toBeTruthy();
    }
  });
});
