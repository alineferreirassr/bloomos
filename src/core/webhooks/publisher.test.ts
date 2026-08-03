import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/core/webhooks/webhookEndpointStore", () => ({
  listWebhookEndpointsForWorkspace: vi.fn(),
}));
vi.mock("@/core/webhooks/retryEngine", () => ({
  deliverWithRetry: vi.fn(),
}));

import { publishWebhookEvent } from "@/core/webhooks/publisher";
import { listWebhookEndpointsForWorkspace } from "@/lib/data/core/webhooks/webhookEndpointStore";
import { deliverWithRetry } from "@/core/webhooks/retryEngine";
import { registerWebhookEvent, resetWebhookEventRegistry } from "@/core/webhooks/eventRegistry";
import type { WebhookEndpoint } from "@/types/webhookEndpoint";

function endpoint(overrides: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  return {
    id: "webhook-endpoint_1",
    workspace_id: "ws_1",
    url: "https://example.com/webhooks",
    description: null,
    secret: "whsec_test",
    secret_prefix: "whsec_test",
    subscribed_events: ["client.created"],
    status: "enabled",
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    rotated_at: null,
    last_delivery_at: null,
    last_delivery_status: null,
    ...overrides,
  };
}

afterEach(() => {
  resetWebhookEventRegistry();
  vi.clearAllMocks();
});

describe("publishWebhookEvent", () => {
  it("does nothing (never throws) when the event type has no registered definition", () => {
    vi.mocked(listWebhookEndpointsForWorkspace).mockReturnValue([]);
    expect(() => publishWebhookEvent({ type: "client.created", workspaceId: "ws_1", resource: { type: "client", id: "c_1" }, payload: {} })).not.toThrow();
    expect(deliverWithRetry).not.toHaveBeenCalled();
  });

  it("calls deliverWithRetry once per enabled, subscribed endpoint", () => {
    registerWebhookEvent({ type: "client.created", category: "crm", name: "Client Created", description: "...", version: 1, payloadSchema: {} });
    vi.mocked(listWebhookEndpointsForWorkspace).mockReturnValue([endpoint({ id: "ep_1" }), endpoint({ id: "ep_2" })]);
    vi.mocked(deliverWithRetry).mockResolvedValue({} as never);

    publishWebhookEvent({ type: "client.created", workspaceId: "ws_1", resource: { type: "client", id: "c_1" }, payload: { id: "c_1" } });

    expect(deliverWithRetry).toHaveBeenCalledTimes(2);
  });

  it("never calls deliverWithRetry for a disabled endpoint", () => {
    registerWebhookEvent({ type: "client.created", category: "crm", name: "Client Created", description: "...", version: 1, payloadSchema: {} });
    vi.mocked(listWebhookEndpointsForWorkspace).mockReturnValue([endpoint({ status: "disabled" })]);

    publishWebhookEvent({ type: "client.created", workspaceId: "ws_1", resource: { type: "client", id: "c_1" }, payload: {} });
    expect(deliverWithRetry).not.toHaveBeenCalled();
  });

  it("never calls deliverWithRetry for an endpoint not subscribed to this event type", () => {
    registerWebhookEvent({ type: "client.created", category: "crm", name: "Client Created", description: "...", version: 1, payloadSchema: {} });
    vi.mocked(listWebhookEndpointsForWorkspace).mockReturnValue([endpoint({ subscribed_events: ["invoice.paid"] })]);

    publishWebhookEvent({ type: "client.created", workspaceId: "ws_1", resource: { type: "client", id: "c_1" }, payload: {} });
    expect(deliverWithRetry).not.toHaveBeenCalled();
  });

  it("never blocks the caller — returns synchronously without awaiting delivery", () => {
    registerWebhookEvent({ type: "client.created", category: "crm", name: "Client Created", description: "...", version: 1, payloadSchema: {} });
    vi.mocked(listWebhookEndpointsForWorkspace).mockReturnValue([endpoint()]);
    let resolved = false;
    vi.mocked(deliverWithRetry).mockImplementation(() => new Promise((resolve) => setTimeout(() => { resolved = true; resolve({} as never); }, 1000)));

    const result = publishWebhookEvent({ type: "client.created", workspaceId: "ws_1", resource: { type: "client", id: "c_1" }, payload: {} });

    expect(result).toBeUndefined(); // returns void, synchronously
    expect(resolved).toBe(false); // the slow delivery hasn't finished yet
  });
});
