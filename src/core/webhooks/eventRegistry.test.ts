import { afterEach, describe, expect, it } from "vitest";
import { registerWebhookEvent, unregisterWebhookEvent, getWebhookEvent, listWebhookEvents, listWebhookEventsByCategory, resetWebhookEventRegistry } from "@/core/webhooks/eventRegistry";
import type { WebhookEventDefinition } from "@/types/webhookEvent";

function definition(overrides: Partial<WebhookEventDefinition> = {}): WebhookEventDefinition {
  return {
    type: "client.created",
    category: "crm",
    name: "Client Created",
    description: "A new Client was added.",
    version: 1,
    payloadSchema: { type: "object" },
    ...overrides,
  };
}

afterEach(() => {
  resetWebhookEventRegistry();
});

describe("eventRegistry", () => {
  it("registers and retrieves a definition by type", () => {
    registerWebhookEvent(definition());
    expect(getWebhookEvent("client.created")?.name).toBe("Client Created");
  });

  it("returns undefined for an unregistered type", () => {
    expect(getWebhookEvent("client.created")).toBeUndefined();
  });

  it("lists every registered definition", () => {
    registerWebhookEvent(definition({ type: "client.created" }));
    registerWebhookEvent(definition({ type: "invoice.paid", category: "finance" }));
    expect(listWebhookEvents()).toHaveLength(2);
  });

  it("filters by category", () => {
    registerWebhookEvent(definition({ type: "client.created", category: "crm" }));
    registerWebhookEvent(definition({ type: "invoice.paid", category: "finance" }));
    expect(listWebhookEventsByCategory("crm").map((d) => d.type)).toEqual(["client.created"]);
  });

  it("unregister removes a definition", () => {
    registerWebhookEvent(definition());
    unregisterWebhookEvent("client.created");
    expect(getWebhookEvent("client.created")).toBeUndefined();
  });

  it("registering the same type twice overwrites, never duplicates in listWebhookEvents", () => {
    registerWebhookEvent(definition({ name: "First" }));
    registerWebhookEvent(definition({ name: "Second" }));
    expect(listWebhookEvents()).toHaveLength(1);
    expect(getWebhookEvent("client.created")?.name).toBe("Second");
  });

  it("reset clears the entire registry", () => {
    registerWebhookEvent(definition());
    resetWebhookEventRegistry();
    expect(listWebhookEvents()).toHaveLength(0);
  });
});
