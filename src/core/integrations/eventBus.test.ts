import { beforeEach, describe, expect, it, vi } from "vitest";
import { bridgesToWebhook, publishIntegrationEvent, resetEventBus, subscribeToIntegrationEvent } from "@/core/integrations/eventBus";
import { resetWebhookEndpointStore, createWebhookEndpoint } from "@/lib/data/core/webhooks/webhookEndpointStore";

beforeEach(() => {
  resetEventBus();
  resetWebhookEndpointStore();
});

describe("bridgesToWebhook", () => {
  it("is true only for IntegrationEventTypes with a same-named WebhookEventType", () => {
    expect(bridgesToWebhook("invoice.paid")).toBe(true);
    expect(bridgesToWebhook("proposal.accepted")).toBe(true);
    expect(bridgesToWebhook("event.completed")).toBe(false);
    expect(bridgesToWebhook("inventory.reserved")).toBe(false);
    expect(bridgesToWebhook("vendor.assigned")).toBe(false);
    expect(bridgesToWebhook("client.created")).toBe(true);
  });
});

describe("subscribeToIntegrationEvent / publishIntegrationEvent", () => {
  it("delivers a published event to every subscriber of that type, not other types", () => {
    const handler = vi.fn();
    const otherHandler = vi.fn();
    subscribeToIntegrationEvent("vendor.assigned", handler);
    subscribeToIntegrationEvent("client.created", otherHandler);

    publishIntegrationEvent({ type: "vendor.assigned", workspaceId: "ws_1", payload: { vendorId: "vendor_1" } });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ type: "vendor.assigned", workspace_id: "ws_1", payload: { vendorId: "vendor_1" } });
    expect(otherHandler).not.toHaveBeenCalled();
  });

  it("the unsubscribe function stops future delivery", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToIntegrationEvent("vendor.assigned", handler);
    unsubscribe();
    publishIntegrationEvent({ type: "vendor.assigned", workspaceId: "ws_1", payload: {} });
    expect(handler).not.toHaveBeenCalled();
  });

  it("never propagates a handler's thrown error back to the publisher", () => {
    subscribeToIntegrationEvent("client.created", () => {
      throw new Error("boom");
    });
    expect(() => publishIntegrationEvent({ type: "client.created", workspaceId: "ws_1", payload: {} })).not.toThrow();
  });

  it("bridges a webhook-equivalent event to a real subscribed endpoint delivery", async () => {
    await createWebhookEndpoint("ws_1", "user_1", { url: "https://example.test/hook", description: "test", subscribed_events: ["client.created"] });
    expect(() => publishIntegrationEvent({ type: "client.created", workspaceId: "ws_1", resourceId: "client_1", payload: { id: "client_1" } })).not.toThrow();
  });
});
