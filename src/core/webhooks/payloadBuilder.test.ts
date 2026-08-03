import { afterEach, describe, expect, it } from "vitest";
import { buildWebhookEventEnvelope, buildTestWebhookEventEnvelope, UnknownWebhookEventError } from "@/core/webhooks/payloadBuilder";
import { registerWebhookEvent, resetWebhookEventRegistry } from "@/core/webhooks/eventRegistry";

afterEach(() => {
  resetWebhookEventRegistry();
});

describe("buildWebhookEventEnvelope", () => {
  it("throws UnknownWebhookEventError for a type with no registered definition", () => {
    expect(() => buildWebhookEventEnvelope({ type: "client.created", workspaceId: "ws_1", resource: { type: "client", id: "c_1" }, payload: {} })).toThrow(UnknownWebhookEventError);
  });

  it("builds a full envelope carrying the registered definition's own version, and the caller's own resource/payload/metadata", () => {
    registerWebhookEvent({ type: "client.created", category: "crm", name: "Client Created", description: "...", version: 3, payloadSchema: {} });

    const envelope = buildWebhookEventEnvelope({
      type: "client.created",
      workspaceId: "ws_1",
      resource: { type: "client", id: "c_1" },
      payload: { id: "c_1", first_name: "Naomi" },
      metadata: { source: "system" },
    });

    expect(envelope.event).toBe("client.created");
    expect(envelope.version).toBe(3);
    expect(envelope.workspace).toBe("ws_1");
    expect(envelope.resource).toEqual({ type: "client", id: "c_1" });
    expect(envelope.payload).toEqual({ id: "c_1", first_name: "Naomi" });
    expect(envelope.metadata).toEqual({ source: "system" });
    expect(envelope.id).toBeTruthy();
    expect(envelope.timestamp).toBeTruthy();
  });

  it("defaults metadata to an empty object when omitted", () => {
    registerWebhookEvent({ type: "client.created", category: "crm", name: "Client Created", description: "...", version: 1, payloadSchema: {} });
    const envelope = buildWebhookEventEnvelope({ type: "client.created", workspaceId: "ws_1", resource: { type: "client", id: "c_1" }, payload: {} });
    expect(envelope.metadata).toEqual({});
  });

  it("never exposes anything beyond what the caller passed in payload — no raw-record fallback", () => {
    registerWebhookEvent({ type: "client.created", category: "crm", name: "Client Created", description: "...", version: 1, payloadSchema: {} });
    const envelope = buildWebhookEventEnvelope({ type: "client.created", workspaceId: "ws_1", resource: { type: "client", id: "c_1" }, payload: { safe: true } });
    expect(Object.keys(envelope.payload as object)).toEqual(["safe"]);
  });
});

describe("buildTestWebhookEventEnvelope", () => {
  it("builds a synthetic webhook.test envelope, never a real catalog event type", () => {
    const envelope = buildTestWebhookEventEnvelope("ws_1");
    expect(envelope.event).toBe("webhook.test");
    expect(envelope.workspace).toBe("ws_1");
    expect(envelope.payload.message).toBeTruthy();
  });
});
