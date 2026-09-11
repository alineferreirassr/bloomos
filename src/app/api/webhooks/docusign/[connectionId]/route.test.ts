import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

interface DispatchedTrigger {
  type: string;
  actorMemberId: unknown;
  facts: unknown;
}

const { resolveDocuSignWebhookContextMock, reconcileVerifiedDocuSignEnvelopeMock, dispatchAutomationTriggerMock, publishIntegrationEventMock } = vi.hoisted(() => ({
  resolveDocuSignWebhookContextMock: vi.fn(),
  reconcileVerifiedDocuSignEnvelopeMock: vi.fn(),
  dispatchAutomationTriggerMock: vi.fn((trigger: unknown) => {
    void trigger;
    return Promise.resolve([] as unknown[]);
  }),
  publishIntegrationEventMock: vi.fn(),
}));

vi.mock("@/core/integrations/providers/docusign/trustedReconciliation", () => ({
  resolveDocuSignWebhookContext: resolveDocuSignWebhookContextMock,
  reconcileVerifiedDocuSignEnvelope: reconcileVerifiedDocuSignEnvelopeMock,
}));
vi.mock("@/core/automation/resolver", () => ({ dispatchAutomationTrigger: dispatchAutomationTriggerMock }));
vi.mock("@/core/integrations/eventBus", () => ({ publishIntegrationEvent: publishIntegrationEventMock }));

import { POST } from "./route";
import { resetQueueEngine } from "@/core/integrations/queueEngine";
import { getAuditLogForConnection } from "@/core/integrations/auditCenter";

const CONNECT_SECRET = "connect_secret";
const CTX = { connectionId: "conn_1", workspaceId: "ws_1", webhookSecret: CONNECT_SECRET, accessToken: "tok_123", accountId: "acct_1", accountBaseUri: "https://demo.docusign.net" };

function signedRequest(body: string, secret = CONNECT_SECRET): Request {
  const signature = createHmac("sha256", secret).update(body, "utf8").digest("base64");
  return new Request("https://app.example.com/x", { method: "POST", body, headers: { "x-docusign-signature-1": signature } });
}

function post(connectionId: string, request: Request) {
  return POST(request, { params: Promise.resolve({ connectionId }) });
}

function stubFetchStatus(status: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ status }), { status: 200 })));
}

beforeEach(() => {
  resetQueueEngine();
  resolveDocuSignWebhookContextMock.mockReset();
  reconcileVerifiedDocuSignEnvelopeMock.mockReset();
  dispatchAutomationTriggerMock.mockClear();
  dispatchAutomationTriggerMock.mockResolvedValue([]);
  publishIntegrationEventMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/webhooks/docusign/[connectionId] — connection/secret resolution (CONTRACTS-03B)", () => {
  it("404s when the trusted context cannot be resolved (unknown connection, wrong provider, or no service-role credential)", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(null);
    const response = await post("nope", new Request("https://app.example.com/x", { method: "POST", body: "{}" }));
    expect(response.status).toBe(404);
  });

  it("400s when the X-DocuSign-Signature-1 header is missing", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    const response = await post("conn_1", new Request("https://app.example.com/x", { method: "POST", body: "{}" }));
    expect(response.status).toBe(400);
  });

  it("400s and records a rejection when the signature is invalid", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    const response = await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" }), "wrong_secret"));
    expect(response.status).toBe(400);
    const log = await getAuditLogForConnection("ws_1", "conn_1");
    expect(log.some((entry) => entry.action === "docusign.webhook.rejected")).toBe(true);
  });

  it("400s on malformed JSON even with a valid signature", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    const body = "not json";
    const signature = createHmac("sha256", CONNECT_SECRET).update(body, "utf8").digest("base64");
    const response = await post("conn_1", new Request("https://app.example.com/x", { method: "POST", body, headers: { "x-docusign-signature-1": signature } }));
    expect(response.status).toBe(400);
  });

  it("verifies the signature before ever calling the privileged re-poll/reconciliation path", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" }), "wrong_secret"));
    expect(reconcileVerifiedDocuSignEnvelopeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/docusign/[connectionId] — generic (non-reconciliation) events unchanged", () => {
  it("processes an unmapped event through the existing generic path and returns handled:false", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    const body = JSON.stringify({ event: "recipient-viewed", envelopeId: "env_1" });
    const response = await post("conn_1", signedRequest(body));
    expect(response.status).toBe(200);
    const json = (await response.json()) as { received: boolean; handled: boolean };
    expect(json.received).toBe(true);
    expect(json.handled).toBe(false);
    expect(reconcileVerifiedDocuSignEnvelopeMock).not.toHaveBeenCalled();
  });

  it("falls through to the generic path when a reconciliation-eligible event has no envelopeId", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    const body = JSON.stringify({ event: "envelope-completed" });
    const response = await post("conn_1", signedRequest(body));
    expect(response.status).toBe(200);
    expect(reconcileVerifiedDocuSignEnvelopeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/docusign/[connectionId] — DocuSign re-poll as source of truth (CONTRACTS-03B)", () => {
  it("never trusts the webhook body's own claimed status — always re-polls DocuSign before reconciling", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("completed");
    reconcileVerifiedDocuSignEnvelopeMock.mockResolvedValue({ mutated: true, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });

    const body = JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" });
    await post("conn_1", signedRequest(body));

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/envelopes/env_1"), expect.any(Object));
    expect(reconcileVerifiedDocuSignEnvelopeMock).toHaveBeenCalledWith({ connectionId: "conn_1", envelopeId: "env_1", mappedStatus: "signed" });
  });

  it("maps a DocuSign re-poll of declined to mappedStatus 'declined'", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("declined");
    reconcileVerifiedDocuSignEnvelopeMock.mockResolvedValue({ mutated: true, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });

    await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-declined", envelopeId: "env_1" })));
    expect(reconcileVerifiedDocuSignEnvelopeMock).toHaveBeenCalledWith({ connectionId: "conn_1", envelopeId: "env_1", mappedStatus: "declined" });
  });

  it("maps a DocuSign re-poll of voided to mappedStatus 'declined'", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("voided");
    reconcileVerifiedDocuSignEnvelopeMock.mockResolvedValue({ mutated: true, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });

    await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-voided", envelopeId: "env_1" })));
    expect(reconcileVerifiedDocuSignEnvelopeMock).toHaveBeenCalledWith({ connectionId: "conn_1", envelopeId: "env_1", mappedStatus: "declined" });
  });

  it("never mutates when the re-poll reports a transient/non-terminal status (sent)", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("sent");

    const response = await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" })));
    const json = (await response.json()) as { handled: boolean };
    expect(json.handled).toBe(false);
    expect(reconcileVerifiedDocuSignEnvelopeMock).not.toHaveBeenCalled();
  });

  it("never mutates when the re-poll reports viewed/delivered", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("delivered");

    const response = await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" })));
    const json = (await response.json()) as { handled: boolean };
    expect(json.handled).toBe(false);
    expect(reconcileVerifiedDocuSignEnvelopeMock).not.toHaveBeenCalled();
  });

  it("skips reconciliation cleanly when the connection has no usable OAuth credential to re-poll with", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue({ ...CTX, accessToken: null });
    const response = await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" })));
    expect(response.status).toBe(200);
    const json = (await response.json()) as { handled: boolean };
    expect(json.handled).toBe(false);
    expect(reconcileVerifiedDocuSignEnvelopeMock).not.toHaveBeenCalled();
  });

  it("fails closed (handled:false, 200) when the DocuSign re-poll itself throws", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    const response = await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" })));
    expect(response.status).toBe(200);
    const json = (await response.json()) as { handled: boolean };
    expect(json.handled).toBe(false);
    expect(reconcileVerifiedDocuSignEnvelopeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/docusign/[connectionId] — side effects fire exactly once, only on a real mutation (CONTRACTS-03B)", () => {
  it("dispatches contract.signed and the generic signature.completed trigger exactly once on a successful, first-time reconciliation", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("completed");
    reconcileVerifiedDocuSignEnvelopeMock.mockResolvedValue({ mutated: true, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });

    const response = await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" })));
    const json = (await response.json()) as { handled: boolean };
    expect(json.handled).toBe(true);

    expect(publishIntegrationEventMock).toHaveBeenCalledTimes(1);
    expect(publishIntegrationEventMock).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws_1", type: "signature.completed" }));

    expect(dispatchAutomationTriggerMock).toHaveBeenCalledTimes(2);
    const dispatchedTypes = dispatchAutomationTriggerMock.mock.calls.map((call) => (call[0] as DispatchedTrigger).type);
    expect(dispatchedTypes).toEqual(expect.arrayContaining(["signature.completed", "contract.signed"]));
    for (const call of dispatchAutomationTriggerMock.mock.calls) {
      expect((call[0] as DispatchedTrigger).actorMemberId).toBeNull();
      expect((call[0] as DispatchedTrigger).facts).toEqual({ contractId: "contract_1", clientId: "client_1" });
    }
  });

  it("dispatches no trigger and no event when the reconciliation reports a duplicate (mutated:false)", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("completed");
    reconcileVerifiedDocuSignEnvelopeMock.mockResolvedValue({ mutated: false, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });

    const response = await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" })));
    const json = (await response.json()) as { handled: boolean };
    expect(json.handled).toBe(false);
    expect(publishIntegrationEventMock).not.toHaveBeenCalled();
    expect(dispatchAutomationTriggerMock).not.toHaveBeenCalled();
  });

  it("dispatches exactly one generic trigger and never contract.declined — matches markDeclined's own existing behavior of no such trigger", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("declined");
    reconcileVerifiedDocuSignEnvelopeMock.mockResolvedValue({ mutated: true, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });

    const response = await post("conn_1", signedRequest(JSON.stringify({ event: "envelope-declined", envelopeId: "env_1" })));
    const json = (await response.json()) as { handled: boolean };
    expect(json.handled).toBe(true);

    expect(dispatchAutomationTriggerMock).toHaveBeenCalledTimes(1);
    expect((dispatchAutomationTriggerMock.mock.calls[0][0] as DispatchedTrigger).type).toBe("signature.declined");
    expect(dispatchAutomationTriggerMock.mock.calls.every((call) => (call[0] as DispatchedTrigger).type !== "contract.declined")).toBe(true);
  });

  it("delivering the same completed webhook twice reconciles idempotently (second call reports mutated:false, no duplicate side effects)", async () => {
    resolveDocuSignWebhookContextMock.mockResolvedValue(CTX);
    stubFetchStatus("completed");
    reconcileVerifiedDocuSignEnvelopeMock.mockResolvedValueOnce({ mutated: true, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });
    reconcileVerifiedDocuSignEnvelopeMock.mockResolvedValueOnce({ mutated: false, contractId: "contract_1", workspaceId: "ws_1", clientId: "client_1" });

    const body = JSON.stringify({ event: "envelope-completed", envelopeId: "env_1" });
    const first = await post("conn_1", signedRequest(body));
    expect(((await first.json()) as { handled: boolean }).handled).toBe(true);
    const firstDispatchCount = dispatchAutomationTriggerMock.mock.calls.length;

    const second = await post("conn_1", signedRequest(body));
    expect(((await second.json()) as { handled: boolean }).handled).toBe(false);
    expect(dispatchAutomationTriggerMock.mock.calls.length).toBe(firstDispatchCount);
  });
});
