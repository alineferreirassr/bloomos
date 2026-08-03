import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { installProvider, applyConnectionEvent, attachCredential } from "@/core/integrations/integrationManager";
import { issueProviderSecretCredential } from "@/core/integrations/credentialManager";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetQueueEngine } from "@/core/integrations/queueEngine";

function signBody(body: string, secret: string): string {
  const params = new URLSearchParams(body);
  const sortedKeys = [...params.keys()].sort();
  const concatenated = sortedKeys.reduce((acc, key) => acc + key + params.get(key), "");
  return createHmac("sha1", secret).update(concatenated).digest("base64");
}

async function setUpConnectedTwilioConnection(): Promise<string> {
  registerBuiltinProviders();
  const connection = await installProvider({ workspaceId: "ws_1", providerId: "twilio", installedBy: "m1" });
  const credential = await issueProviderSecretCredential({ workspaceId: "ws_1", connectionId: connection.id, createdBy: "m1", secret: "AC_test:auth_token_123:+15551234567" });
  attachCredential(connection.id, credential.id);
  await applyConnectionEvent(connection.id, "connect_requested", "m1");
  await applyConnectionEvent(connection.id, "connect_succeeded", "m1");
  return connection.id;
}

afterEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetQueueEngine();
});

describe("POST /api/webhooks/twilio/[connectionId]", () => {
  it("404s for an unknown connection", async () => {
    const response = await POST(new Request("https://app.example.com/api/webhooks/twilio/nope", { method: "POST", body: "MessageStatus=delivered" }), { params: Promise.resolve({ connectionId: "nope" }) });
    expect(response.status).toBe(404);
  });

  it("400s when the X-Twilio-Signature header is missing", async () => {
    const connectionId = await setUpConnectedTwilioConnection();
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body: "MessageStatus=delivered" }), { params: Promise.resolve({ connectionId }) });
    expect(response.status).toBe(400);
  });

  it("400s and records a rejection when the signature is invalid", async () => {
    const connectionId = await setUpConnectedTwilioConnection();
    const body = "MessageStatus=delivered&MessageSid=SM1";
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body, headers: { "x-twilio-signature": "bogus" } }), { params: Promise.resolve({ connectionId }) });
    expect(response.status).toBe(400);
  });

  it("processes a correctly-signed delivered status and returns handled:true", async () => {
    const connectionId = await setUpConnectedTwilioConnection();
    const body = "MessageStatus=delivered&MessageSid=SM1&To=%2B15559998888";
    const signature = signBody(body, "auth_token_123");
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body, headers: { "x-twilio-signature": signature } }), { params: Promise.resolve({ connectionId }) });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { received: boolean; handled: boolean };
    expect(json.received).toBe(true);
    expect(json.handled).toBe(true);
  });

  it("never throws a 5xx even when the mapped event is unknown", async () => {
    const connectionId = await setUpConnectedTwilioConnection();
    const body = "MessageStatus=queued&MessageSid=SM1";
    const signature = signBody(body, "auth_token_123");
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body, headers: { "x-twilio-signature": signature } }), { params: Promise.resolve({ connectionId }) });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { handled: boolean };
    expect(json.handled).toBe(false);
  });
});
