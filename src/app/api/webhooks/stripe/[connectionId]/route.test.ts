import { afterEach, describe, expect, it, vi } from "vitest";

const { fakeConnection, fakeClient } = vi.hoisted(() => ({
  fakeConnection: { id: "conn_1", provider_id: "stripe", workspace_id: "ws_1", state: "connected", config: { webhook_secret_credential_id: "cred_whsec" } },
  fakeClient: { webhooks: { constructEvent: vi.fn() } },
}));

vi.mock("@/core/integrations/integrationManager", () => ({
  getConnection: vi.fn().mockReturnValue(fakeConnection),
}));

vi.mock("@/core/integrations/credentialManager", () => ({
  resolveProviderSecret: vi.fn().mockResolvedValue("whsec_real_secret"),
}));

vi.mock("@/core/integrations/providers/stripe/stripeClient", () => ({
  getStripeClientForConnection: vi.fn().mockResolvedValue(fakeClient),
}));

const processStripeWebhookEvent = vi.fn().mockResolvedValue({ handled: true, summary: "ok" });
vi.mock("@/modules/integrations/stripe/webhookProcessing", () => ({
  processStripeWebhookEvent: (...args: unknown[]) => processStripeWebhookEvent(...args),
}));

vi.mock("@/core/audit", () => ({
  getCoreAuditLogService: () => ({ recordAuditEvent: vi.fn().mockResolvedValue({ id: "audit_1" }) }),
}));

import { POST } from "@/app/api/webhooks/stripe/[connectionId]/route";
import { getConnection } from "@/core/integrations/integrationManager";
import { resetQueueEngine, listJobsForWorkspace } from "@/core/integrations/queueEngine";

function makeRequest(body: string, signature: string | null): Request {
  const headers = new Headers();
  if (signature) headers.set("stripe-signature", signature);
  return new Request("https://app.test/api/webhooks/stripe/conn_1", { method: "POST", headers, body });
}

afterEach(() => {
  vi.clearAllMocks();
  resetQueueEngine();
  fakeClient.webhooks.constructEvent.mockReset();
});

describe("POST /api/webhooks/stripe/[connectionId]", () => {
  it("404s for an unknown connection", async () => {
    vi.mocked(getConnection).mockReturnValueOnce(null);
    const response = await POST(makeRequest("{}", "t=1,v1=abc"), { params: Promise.resolve({ connectionId: "conn_missing" }) });
    expect(response.status).toBe(404);
  });

  it("400s when the signature header is missing", async () => {
    const response = await POST(makeRequest("{}", null), { params: Promise.resolve({ connectionId: "conn_1" }) });
    expect(response.status).toBe(400);
  });

  it("400s when the real signature verification fails", async () => {
    fakeClient.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });
    const response = await POST(makeRequest("{}", "t=1,v1=bad"), { params: Promise.resolve({ connectionId: "conn_1" }) });
    expect(response.status).toBe(400);
    expect(processStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it("processes a real, verified event and records a real Queue Engine job", async () => {
    fakeClient.webhooks.constructEvent.mockReturnValue({ id: "evt_1", type: "checkout.session.completed", data: { object: {} } });
    const response = await POST(makeRequest('{"id":"evt_1"}', "t=1,v1=real"), { params: Promise.resolve({ connectionId: "conn_1" }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ received: true, handled: true });
    expect(processStripeWebhookEvent).toHaveBeenCalledWith("ws_1", "conn_1", expect.objectContaining({ id: "evt_1" }));

    const jobs = listJobsForWorkspace("ws_1");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe("succeeded");
    expect(jobs[0].kind).toBe("checkout.session.completed");
  });

  it("still returns 200 (never a 5xx) when processing ultimately fails, but marks the Queue job failed", async () => {
    fakeClient.webhooks.constructEvent.mockReturnValue({ id: "evt_2", type: "checkout.session.completed", data: { object: {} } });
    processStripeWebhookEvent.mockRejectedValue(new Error("downstream unavailable"));

    const response = await POST(makeRequest('{"id":"evt_2"}', "t=1,v1=real"), { params: Promise.resolve({ connectionId: "conn_1" }) });
    expect(response.status).toBe(200);

    const jobs = listJobsForWorkspace("ws_1");
    expect(jobs[0].status).toBe("failed");
  });
});
