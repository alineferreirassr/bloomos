import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/webhooks/dispatcher", () => ({
  dispatchWebhookDelivery: vi.fn(),
}));

import { deliverWithRetry, computeBackoffDelayMs, MAX_DELIVERY_ATTEMPTS } from "@/core/webhooks/retryEngine";
import { dispatchWebhookDelivery } from "@/core/webhooks/dispatcher";
import { resetWebhookDeliveryStore, listWebhookDeliveriesForEndpoint } from "@/lib/data/core/webhooks/webhookDeliveryStore";
import { resetWebhookEndpointStore } from "@/lib/data/core/webhooks/webhookEndpointStore";
import type { WebhookEndpoint } from "@/types/webhookEndpoint";
import type { WebhookDispatchResult } from "@/core/webhooks/dispatcher";

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

function dispatchResult(overrides: Partial<WebhookDispatchResult> = {}): WebhookDispatchResult {
  return { success: false, statusCode: 500, durationMs: 10, error: "HTTP 500", requestHeaders: {}, responseHeaders: null, responseBodyExcerpt: null, ...overrides };
}

afterEach(() => {
  resetWebhookDeliveryStore();
  resetWebhookEndpointStore();
  vi.clearAllMocks();
});

describe("computeBackoffDelayMs", () => {
  it("doubles per attempt, capped at 60s", () => {
    expect(computeBackoffDelayMs(1)).toBe(1000);
    expect(computeBackoffDelayMs(2)).toBe(2000);
    expect(computeBackoffDelayMs(3)).toBe(4000);
    expect(computeBackoffDelayMs(4)).toBe(8000);
    expect(computeBackoffDelayMs(10)).toBe(60_000);
  });
});

describe("deliverWithRetry", () => {
  it("marks the delivery success on the first attempt when dispatch succeeds", async () => {
    vi.mocked(dispatchWebhookDelivery).mockResolvedValue(dispatchResult({ success: true, statusCode: 200, error: null }));

    const delivery = await deliverWithRetry({ endpoint: endpoint(), envelope: { id: "whevt_1", event: "client.created" }, body: "{}" });

    expect(delivery.status).toBe("success");
    expect(delivery.attempts).toBe(1);
    expect(dispatchWebhookDelivery).toHaveBeenCalledTimes(1);
  });

  it("retries on failure up to MAX_DELIVERY_ATTEMPTS, then moves to dead_letter", async () => {
    vi.mocked(dispatchWebhookDelivery).mockResolvedValue(dispatchResult());

    const delivery = await deliverWithRetry({ endpoint: endpoint(), envelope: { id: "whevt_1", event: "client.created" }, body: "{}" });

    expect(delivery.status).toBe("dead_letter");
    expect(delivery.attempts).toBe(MAX_DELIVERY_ATTEMPTS);
    expect(dispatchWebhookDelivery).toHaveBeenCalledTimes(MAX_DELIVERY_ATTEMPTS);
  });

  it("succeeds after an initial failure, recording exactly the attempts it took", async () => {
    vi.mocked(dispatchWebhookDelivery)
      .mockResolvedValueOnce(dispatchResult())
      .mockResolvedValueOnce(dispatchResult({ success: true, statusCode: 200, error: null }));

    const delivery = await deliverWithRetry({ endpoint: endpoint(), envelope: { id: "whevt_1", event: "client.created" }, body: "{}" });

    expect(delivery.status).toBe("success");
    expect(delivery.attempts).toBe(2);
    expect(dispatchWebhookDelivery).toHaveBeenCalledTimes(2);
  });

  it("persists one delivery record per (event, endpoint), updated in place across attempts — never one row per attempt", async () => {
    vi.mocked(dispatchWebhookDelivery).mockResolvedValue(dispatchResult());
    const ep = endpoint();
    await deliverWithRetry({ endpoint: ep, envelope: { id: "whevt_1", event: "client.created" }, body: "{}" });

    expect(listWebhookDeliveriesForEndpoint(ep.id)).toHaveLength(1);
  });

  it("stores the exact request_body it was given, for later Replay", async () => {
    vi.mocked(dispatchWebhookDelivery).mockResolvedValue(dispatchResult({ success: true, statusCode: 200, error: null }));
    const body = JSON.stringify({ exact: "bytes" });

    const delivery = await deliverWithRetry({ endpoint: endpoint(), envelope: { id: "whevt_1", event: "client.created" }, body });
    expect(delivery.request_body).toBe(body);
  });

  it("marks a replay with replayed_from_delivery_id and a test delivery with is_test", async () => {
    vi.mocked(dispatchWebhookDelivery).mockResolvedValue(dispatchResult({ success: true, statusCode: 200, error: null }));

    const replay = await deliverWithRetry({ endpoint: endpoint(), envelope: { id: "whevt_1", event: "client.created" }, body: "{}", replayedFromDeliveryId: "webhook-delivery_original" });
    expect(replay.replayed_from_delivery_id).toBe("webhook-delivery_original");

    const test = await deliverWithRetry({ endpoint: endpoint(), envelope: { id: "whevt_2", event: "webhook.test" }, body: "{}", isTest: true });
    expect(test.is_test).toBe(true);
  });
});
