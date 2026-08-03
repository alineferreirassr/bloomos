import { beforeEach, describe, expect, it } from "vitest";
import { createWebhookDelivery, resetWebhookDeliveryStore, updateWebhookDelivery } from "@/lib/data/core/webhooks/webhookDeliveryStore";
import { listDeadLetterDeliveries } from "@/core/webhooks/deadLetterQueue";

beforeEach(() => {
  resetWebhookDeliveryStore();
});

describe("listDeadLetterDeliveries", () => {
  it("returns only dead_letter deliveries for the given workspace", () => {
    const deadLetter = createWebhookDelivery({ workspace_id: "ws_1", endpoint_id: "ep_1", event_id: "evt_1", event_type: "invoice.paid", max_attempts: 5, request_headers: {}, request_body: "{}" });
    updateWebhookDelivery(deadLetter.id, { status: "dead_letter" });

    createWebhookDelivery({ workspace_id: "ws_1", endpoint_id: "ep_1", event_id: "evt_2", event_type: "invoice.paid", max_attempts: 5, request_headers: {}, request_body: "{}" });
    const otherWorkspace = createWebhookDelivery({ workspace_id: "ws_2", endpoint_id: "ep_2", event_id: "evt_3", event_type: "invoice.paid", max_attempts: 5, request_headers: {}, request_body: "{}" });
    updateWebhookDelivery(otherWorkspace.id, { status: "dead_letter" });

    const result = listDeadLetterDeliveries("ws_1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(deadLetter.id);
  });
});
