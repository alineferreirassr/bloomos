import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchWebhookDelivery } from "@/core/webhooks/dispatcher";
import { WEBHOOK_SIGNATURE_HEADER, verifyWebhookSignature } from "@/lib/webhooks/signature";
import type { WebhookEndpoint } from "@/types/webhookEndpoint";

function endpoint(overrides: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  return {
    id: "webhook-endpoint_1",
    workspace_id: "ws_1",
    url: "https://example.com/webhooks/bloomos",
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
  vi.unstubAllGlobals();
});

describe("dispatchWebhookDelivery", () => {
  it("POSTs the body with a valid, verifiable signature header and returns success on a 2xx response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }));
    vi.stubGlobal("fetch", fetchMock);

    const body = JSON.stringify({ hello: "world" });
    const result = await dispatchWebhookDelivery(endpoint(), { id: "whevt_1", event: "client.created" }, body);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://example.com/webhooks/bloomos");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(body);
    expect(init.headers["x-bloomos-event"]).toBe("client.created");
    expect(init.headers["x-bloomos-delivery"]).toBe("whevt_1");

    const signatureHeader = init.headers[WEBHOOK_SIGNATURE_HEADER];
    const verification = await verifyWebhookSignature({ payload: body, header: signatureHeader, secret: "whsec_test" });
    expect(verification.valid).toBe(true);
  });

  it("reports failure with the status code for a non-2xx response, never throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("error", { status: 500 })));

    const result = await dispatchWebhookDelivery(endpoint(), { id: "whevt_1", event: "client.created" }, "{}");
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
    expect(result.error).toMatch(/500/);
  });

  it("reports a network error as a failed result, never an unhandled rejection", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("getaddrinfo ENOTFOUND")));

    const result = await dispatchWebhookDelivery(endpoint(), { id: "whevt_1", event: "client.created" }, "{}");
    expect(result.success).toBe(false);
    expect(result.statusCode).toBeNull();
    expect(result.error).toMatch(/ENOTFOUND/);
  });

  it("reports a timeout distinctly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        return Promise.reject(error);
      }),
    );

    const result = await dispatchWebhookDelivery(endpoint(), { id: "whevt_1", event: "client.created" }, "{}");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/timed out/i);
  });
});
