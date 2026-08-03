import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { POST } from "./route";
import { installProvider, applyConnectionEvent, attachCredential, setConnectionConfig } from "@/core/integrations/integrationManager";
import { issueOAuthCredential, issueProviderSecretCredential } from "@/core/integrations/credentialManager";
import { registerBuiltinProviders } from "@/modules/integrations/registerBuiltinProviders";
import { resetConnectionStore } from "@/lib/data/core/integrations/connectionStore";
import { resetCredentialStore } from "@/lib/data/core/integrations/credentialStore";
import { resetQueueEngine } from "@/core/integrations/queueEngine";

async function setUpConnectedDocuSignConnection(): Promise<string> {
  registerBuiltinProviders();
  const connection = await installProvider({ workspaceId: "ws_1", providerId: "docusign", installedBy: "m1" });
  const oauthCredential = await issueOAuthCredential({ workspaceId: "ws_1", connectionId: connection.id, scopes: ["signature"], createdBy: "m1", accessToken: "tok_123" });
  attachCredential(connection.id, oauthCredential.id);
  const webhookCredential = await issueProviderSecretCredential({ workspaceId: "ws_1", connectionId: connection.id, createdBy: "m1", secret: "connect_secret" });
  setConnectionConfig(connection.id, { webhook_secret_credential_id: webhookCredential.id });
  await applyConnectionEvent(connection.id, "connect_requested", "m1");
  await applyConnectionEvent(connection.id, "connect_succeeded", "m1");
  return connection.id;
}

afterEach(() => {
  resetConnectionStore();
  resetCredentialStore();
  resetQueueEngine();
});

describe("POST /api/webhooks/docusign/[connectionId]", () => {
  it("404s for an unknown connection", async () => {
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body: "{}" }), { params: Promise.resolve({ connectionId: "nope" }) });
    expect(response.status).toBe(404);
  });

  it("400s when no webhook secret is configured yet", async () => {
    registerBuiltinProviders();
    const connection = await installProvider({ workspaceId: "ws_1", providerId: "docusign", installedBy: "m1" });
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body: "{}" }), { params: Promise.resolve({ connectionId: connection.id }) });
    expect(response.status).toBe(400);
  });

  it("400s when the X-DocuSign-Signature-1 header is missing", async () => {
    const connectionId = await setUpConnectedDocuSignConnection();
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body: "{}" }), { params: Promise.resolve({ connectionId }) });
    expect(response.status).toBe(400);
  });

  it("400s and records a rejection when the signature is invalid", async () => {
    const connectionId = await setUpConnectedDocuSignConnection();
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body: JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" }), headers: { "x-docusign-signature-1": "bogus" } }), { params: Promise.resolve({ connectionId }) });
    expect(response.status).toBe(400);
  });

  it("processes a correctly-signed envelope-completed event and returns handled:true", async () => {
    const connectionId = await setUpConnectedDocuSignConnection();
    const body = JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" });
    const signature = createHmac("sha256", "connect_secret").update(body, "utf8").digest("base64");
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body, headers: { "x-docusign-signature-1": signature } }), { params: Promise.resolve({ connectionId }) });
    expect(response.status).toBe(200);
    const json = (await response.json()) as { received: boolean; handled: boolean };
    expect(json.received).toBe(true);
    expect(json.handled).toBe(true);
  });

  it("400s on malformed JSON even with a header present", async () => {
    const connectionId = await setUpConnectedDocuSignConnection();
    const body = "not json";
    const signature = createHmac("sha256", "connect_secret").update(body, "utf8").digest("base64");
    const response = await POST(new Request("https://app.example.com/x", { method: "POST", body, headers: { "x-docusign-signature-1": signature } }), { params: Promise.resolve({ connectionId }) });
    expect(response.status).toBe(400);
  });
});
