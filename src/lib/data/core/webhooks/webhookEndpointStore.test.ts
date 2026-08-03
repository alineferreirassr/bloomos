import { afterEach, describe, expect, it } from "vitest";
import {
  createWebhookEndpoint,
  listWebhookEndpointsForWorkspace,
  getWebhookEndpointById,
  rotateWebhookEndpointSecret,
  setWebhookEndpointStatus,
  touchWebhookEndpointLastDelivery,
  toPublicWebhookEndpoint,
  resetWebhookEndpointStore,
} from "@/lib/data/core/webhooks/webhookEndpointStore";

afterEach(() => {
  resetWebhookEndpointStore();
});

describe("webhookEndpointStore", () => {
  it("creates an endpoint, returning the public record and the one-time secret — the secret is never on the public record", async () => {
    const { endpoint, secret } = await createWebhookEndpoint("ws_1", "member_1", { url: "https://example.com/hook", description: "Test", subscribed_events: ["client.created"] });
    expect(endpoint.url).toBe("https://example.com/hook");
    expect(endpoint.status).toBe("enabled");
    expect(secret.startsWith("whsec_")).toBe(true);
    expect(endpoint).not.toHaveProperty("secret");
  });

  it("trims an empty description to null", async () => {
    const { endpoint } = await createWebhookEndpoint("ws_1", "member_1", { url: "https://example.com/hook", description: "   ", subscribed_events: ["client.created"] });
    expect(endpoint.description).toBeNull();
  });

  it("scopes listing strictly to one workspace", async () => {
    await createWebhookEndpoint("ws_1", "member_1", { url: "https://a.example.com", description: "", subscribed_events: ["client.created"] });
    await createWebhookEndpoint("ws_2", "member_1", { url: "https://b.example.com", description: "", subscribed_events: ["client.created"] });
    expect(listWebhookEndpointsForWorkspace("ws_1")).toHaveLength(1);
  });

  it("rotate replaces the secret, invalidating the old one, while preserving id/url/subscriptions", async () => {
    const created = await createWebhookEndpoint("ws_1", "member_1", { url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    const rotated = rotateWebhookEndpointSecret(created.endpoint.id);
    expect(rotated).not.toBeNull();
    expect(rotated?.endpoint.id).toBe(created.endpoint.id);
    expect(rotated?.endpoint.url).toBe(created.endpoint.url);
    expect(rotated?.secret).not.toEqual(created.secret);
    expect(getWebhookEndpointById(created.endpoint.id)?.secret).toBe(rotated?.secret);
  });

  it("rotate on an unknown id returns null", () => {
    expect(rotateWebhookEndpointSecret("nonexistent")).toBeNull();
  });

  it("setWebhookEndpointStatus toggles enabled/disabled", async () => {
    const created = await createWebhookEndpoint("ws_1", "member_1", { url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    const disabled = setWebhookEndpointStatus(created.endpoint.id, "disabled");
    expect(disabled?.status).toBe("disabled");
  });

  it("touchWebhookEndpointLastDelivery records the last delivery timestamp and status", async () => {
    const created = await createWebhookEndpoint("ws_1", "member_1", { url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    expect(getWebhookEndpointById(created.endpoint.id)?.last_delivery_at).toBeNull();
    touchWebhookEndpointLastDelivery(created.endpoint.id, "success");
    const updated = getWebhookEndpointById(created.endpoint.id);
    expect(updated?.last_delivery_status).toBe("success");
    expect(updated?.last_delivery_at).not.toBeNull();
  });

  it("toPublicWebhookEndpoint strips the secret from any full record", async () => {
    const created = await createWebhookEndpoint("ws_1", "member_1", { url: "https://example.com/hook", description: "", subscribed_events: ["client.created"] });
    const full = getWebhookEndpointById(created.endpoint.id);
    expect(full).not.toBeNull();
    if (!full) return;
    expect(full).toHaveProperty("secret");
    expect(toPublicWebhookEndpoint(full)).not.toHaveProperty("secret");
  });
});
