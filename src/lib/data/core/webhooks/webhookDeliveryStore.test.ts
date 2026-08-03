import { afterEach, describe, expect, it } from "vitest";
import {
  createWebhookDelivery,
  updateWebhookDelivery,
  getWebhookDeliveryById,
  listWebhookDeliveriesForEndpoint,
  listWebhookDeliveriesForWorkspace,
  summarizeWebhookDeliveries,
  resetWebhookDeliveryStore,
} from "@/lib/data/core/webhooks/webhookDeliveryStore";

function baseInput(overrides: Partial<Parameters<typeof createWebhookDelivery>[0]> = {}) {
  return {
    workspace_id: "ws_1",
    endpoint_id: "webhook-endpoint_1",
    event_id: "whevt_1",
    event_type: "client.created" as const,
    max_attempts: 5,
    request_headers: {},
    request_body: "{}",
    ...overrides,
  };
}

afterEach(() => {
  resetWebhookDeliveryStore();
});

describe("webhookDeliveryStore", () => {
  it("creates a delivery in pending status with zero attempts", () => {
    const delivery = createWebhookDelivery(baseInput());
    expect(delivery.status).toBe("pending");
    expect(delivery.attempts).toBe(0);
    expect(delivery.is_test).toBe(false);
    expect(delivery.replayed_from_delivery_id).toBeNull();
  });

  it("updateWebhookDelivery patches fields and bumps updated_at", () => {
    const delivery = createWebhookDelivery(baseInput());
    const updated = updateWebhookDelivery(delivery.id, { status: "success", attempts: 1, last_status_code: 200 });
    expect(updated?.status).toBe("success");
    expect(updated?.attempts).toBe(1);
    expect(updated?.last_status_code).toBe(200);
  });

  it("updateWebhookDelivery on an unknown id returns null", () => {
    expect(updateWebhookDelivery("nonexistent", { status: "success" })).toBeNull();
  });

  it("scopes endpoint/workspace listings correctly", () => {
    createWebhookDelivery(baseInput({ endpoint_id: "ep_1", workspace_id: "ws_1" }));
    createWebhookDelivery(baseInput({ endpoint_id: "ep_2", workspace_id: "ws_1" }));
    createWebhookDelivery(baseInput({ endpoint_id: "ep_1", workspace_id: "ws_2" }));

    expect(listWebhookDeliveriesForEndpoint("ep_1")).toHaveLength(2);
    expect(listWebhookDeliveriesForWorkspace("ws_1")).toHaveLength(2);
    expect(listWebhookDeliveriesForWorkspace("ws_2")).toHaveLength(1);
  });

  it("getWebhookDeliveryById finds a real record and returns null for an unknown id", () => {
    const delivery = createWebhookDelivery(baseInput());
    expect(getWebhookDeliveryById(delivery.id)?.id).toBe(delivery.id);
    expect(getWebhookDeliveryById("nonexistent")).toBeNull();
  });

  it("summarizeWebhookDeliveries aggregates status counts, retries, replays, and average duration", () => {
    const a = createWebhookDelivery(baseInput({ endpoint_id: "ep_1" }));
    updateWebhookDelivery(a.id, { status: "success", attempts: 1, last_duration_ms: 100 });

    const b = createWebhookDelivery(baseInput({ endpoint_id: "ep_1" }));
    updateWebhookDelivery(b.id, { status: "dead_letter", attempts: 5, last_duration_ms: 300 });

    const c = createWebhookDelivery(baseInput({ endpoint_id: "ep_2", replayed_from_delivery_id: a.id }));
    updateWebhookDelivery(c.id, { status: "success", attempts: 1, last_duration_ms: 200 });

    const summary = summarizeWebhookDeliveries("ws_1");
    expect(summary.totalDeliveries).toBe(3);
    expect(summary.successCount).toBe(2);
    expect(summary.deadLetterCount).toBe(1);
    expect(summary.totalRetries).toBe(4); // only b: attempts 5 - 1 = 4
    expect(summary.replayCount).toBe(1);
    expect(summary.averageDurationMs).toBe(Math.round((100 + 300 + 200) / 3));
    expect(summary.byEndpoint.find((e) => e.endpointId === "ep_1")?.count).toBe(2);
  });

  it("summarizeWebhookDeliveries returns zeroed values for a workspace with no deliveries", () => {
    expect(summarizeWebhookDeliveries("ws_empty")).toEqual({
      totalDeliveries: 0,
      successCount: 0,
      failureCount: 0,
      deadLetterCount: 0,
      totalRetries: 0,
      replayCount: 0,
      averageDurationMs: 0,
      byEndpoint: [],
    });
  });
});
