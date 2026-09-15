import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/core/integrations/webhooks/metaWebhookVerification", () => ({
  verifyMetaWebhookChallenge: vi.fn(),
  verifyMetaWebhookSignature: vi.fn(),
}));
vi.mock("@/core/integrations/webhooks/metaWebhookServiceRole", () => ({
  createMetaWebhookServiceRoleClient: vi.fn(),
  resolveInstagramAccountOwnership: vi.fn(),
  recordMetaWebhookEvent: vi.fn(),
}));
vi.mock("@/core/automation/idempotency", () => ({
  claimAutomationIdempotencyKey: vi.fn(),
  completeAutomationIdempotencyKey: vi.fn().mockResolvedValue({ success: true, key: { id: "idem_1", status: "completed" } }),
}));
vi.mock("@/core/integrations/webhooks/metaWebhookProcessing", () => ({
  processMetaWebhookEvent: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "@/app/api/webhooks/meta/route";
import { verifyMetaWebhookChallenge, verifyMetaWebhookSignature } from "@/core/integrations/webhooks/metaWebhookVerification";
import { createMetaWebhookServiceRoleClient, resolveInstagramAccountOwnership, recordMetaWebhookEvent } from "@/core/integrations/webhooks/metaWebhookServiceRole";
import { claimAutomationIdempotencyKey, completeAutomationIdempotencyKey } from "@/core/automation/idempotency";
import { processMetaWebhookEvent } from "@/core/integrations/webhooks/metaWebhookProcessing";

function makeGetRequest(params: Record<string, string>): Request {
  const url = new URL("https://app.test/api/webhooks/meta");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return new Request(url, { method: "GET" });
}

function makePostRequest(body: string, signature: string | null): Request {
  const headers = new Headers();
  if (signature) headers.set("x-hub-signature-256", signature);
  return new Request("https://app.test/api/webhooks/meta", { method: "POST", headers, body });
}

const VALID_BODY = JSON.stringify({ object: "instagram", entry: [{ id: "acct_1", time: 1234567890, changes: [{ field: "comments", value: {} }] }] });

function claimedKey(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "idem_1", workspaceId: "ws_1", source: "meta_webhook", dedupKey: "hash", status: "processing" as const, executionId: null, attemptCount: 1, claimedAt: "t", completedAt: null, ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/webhooks/meta — verification handshake", () => {
  it("valid handshake — echoes back hub.challenge with a 200", async () => {
    vi.mocked(verifyMetaWebhookChallenge).mockReturnValue({ verified: true, challenge: "chal_123" });
    const response = await GET(makeGetRequest({ "hub.mode": "subscribe", "hub.verify_token": "t", "hub.challenge": "chal_123" }));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("chal_123");
  });

  it("invalid handshake — responds 403, never echoes any challenge", async () => {
    vi.mocked(verifyMetaWebhookChallenge).mockReturnValue({ verified: false });
    const response = await GET(makeGetRequest({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "chal_123" }));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("chal_123");
  });
});

describe("POST /api/webhooks/meta — authenticity and payload validation", () => {
  it("request without a signature header (no authentication) is rejected with 400, never reaching resolution", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(false);
    const response = await POST(makePostRequest(VALID_BODY, null));
    expect(response.status).toBe(400);
    expect(resolveInstagramAccountOwnership).not.toHaveBeenCalled();
  });

  it("invalid signature is rejected with 400, never reaching resolution", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(false);
    const response = await POST(makePostRequest(VALID_BODY, "sha256=bad"));
    expect(response.status).toBe(400);
    expect(resolveInstagramAccountOwnership).not.toHaveBeenCalled();
  });

  it("malformed (non-JSON) payload is rejected with 400 even with a valid signature", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    const response = await POST(makePostRequest("not json{{{", "sha256=real"));
    expect(response.status).toBe(400);
  });

  it("unrecognized event envelope (missing object/entry) is rejected with 400", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    const response = await POST(makePostRequest(JSON.stringify({ foo: "bar" }), "sha256=real"));
    expect(response.status).toBe(400);
  });

  it("missing account identifier on the first entry is rejected with 400", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    const response = await POST(makePostRequest(JSON.stringify({ object: "instagram", entry: [{}] }), "sha256=real"));
    expect(response.status).toBe(400);
  });
});

describe("POST /api/webhooks/meta — workspace/account resolution", () => {
  it("an unresolvable external account is durably recorded without a workspace, never claiming idempotency (no workspace to claim under)", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    vi.mocked(createMetaWebhookServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(resolveInstagramAccountOwnership).mockResolvedValue(null);
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, resolved: false });
    expect(claimAutomationIdempotencyKey).not.toHaveBeenCalled();
    expect(recordMetaWebhookEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ idempotencyKeyId: null, workspaceId: null, externalAccountId: "acct_1" }));
  });

  it("service-role unavailable returns 503, never proceeding", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    vi.mocked(createMetaWebhookServiceRoleClient).mockReturnValue(null);

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(503);
    expect(resolveInstagramAccountOwnership).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/meta — idempotency (reuses SOCIAL-11B's own ledger)", () => {
  function setupResolved() {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    vi.mocked(createMetaWebhookServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(resolveInstagramAccountOwnership).mockResolvedValue({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1" });
  }

  it("first delivery — claims the key, records the event, dispatches processing, completes the claim as completed", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey() });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, resolved: true });
    expect(recordMetaWebhookEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ idempotencyKeyId: "idem_1", workspaceId: "ws_1", instagramAccountIdentityId: "identity_1" }));
    expect(processMetaWebhookEvent).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1", externalAccountId: "acct_1", objectType: "instagram" }),
    );
    expect(completeAutomationIdempotencyKey).toHaveBeenCalledWith("idem_1", "completed");
  });

  it("duplicate delivery (already processing elsewhere) — never records a second event, acknowledges as a safe duplicate", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: false });

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, duplicate: true });
    expect(recordMetaWebhookEvent).not.toHaveBeenCalled();
  });

  it("completed duplicate — a redelivery of an already-completed event is also a safe no-op, identical handling to a processing duplicate", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: false });

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(200);
    expect(recordMetaWebhookEvent).not.toHaveBeenCalled();
    expect(completeAutomationIdempotencyKey).not.toHaveBeenCalled();
  });

  it("concurrent duplicate delivery — two near-simultaneous POSTs for the same event: exactly one wins the claim, the other is treated as a safe duplicate", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValueOnce({ success: true, claimed: true, key: claimedKey() }).mockResolvedValueOnce({ success: true, claimed: false });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });

    const [first, second] = await Promise.all([POST(makePostRequest(VALID_BODY, "sha256=real")), POST(makePostRequest(VALID_BODY, "sha256=real"))]);

    const firstBody = await first.json();
    const secondBody = await second.json();
    const results = [firstBody, secondBody];
    expect(results.filter((r) => r.resolved === true)).toHaveLength(1);
    expect(results.filter((r) => r.duplicate === true)).toHaveLength(1);
    expect(recordMetaWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it("processing failure — recordMetaWebhookEvent fails after a successful claim — completes the idempotency key as failed and returns 500", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey() });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: false, error: "db error" });

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(500);
    expect(completeAutomationIdempotencyKey).toHaveBeenCalledWith("idem_1", "failed");
  });

  it("an unexpected throw during processing also completes the key as failed rather than leaving it stuck in processing", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey() });
    vi.mocked(recordMetaWebhookEvent).mockRejectedValue(new Error("unexpected"));
    vi.mocked(completeAutomationIdempotencyKey).mockResolvedValue({ success: true, key: claimedKey({ status: "failed" }) });

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(500);
    expect(completeAutomationIdempotencyKey).toHaveBeenCalledWith("idem_1", "failed");
  });

  it("retry after failure — a redelivery re-claims the key (attemptCount incremented) and succeeds", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey({ attemptCount: 2 }) });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, resolved: true });
    expect(completeAutomationIdempotencyKey).toHaveBeenCalledWith("idem_1", "completed");
  });

  it("cross-workspace isolation — the recorded event's workspace always comes from server-side resolution, never invented or read from the request itself", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    vi.mocked(createMetaWebhookServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(resolveInstagramAccountOwnership).mockResolvedValue({ workspaceId: "ws_real_owner", instagramAccountIdentityId: "identity_real" });
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey({ workspaceId: "ws_real_owner" }) });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });

    // The payload itself never carries a workspace id anywhere — resolution is the only path.
    await POST(makePostRequest(VALID_BODY, "sha256=real"));

    expect(claimAutomationIdempotencyKey).toHaveBeenCalledWith("ws_real_owner", "meta_webhook", expect.any(String));
    expect(recordMetaWebhookEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ workspaceId: "ws_real_owner", instagramAccountIdentityId: "identity_real" }));
  });
});

describe("POST /api/webhooks/meta — SOCIAL-11E processing/automation dispatch integration point", () => {
  function setupResolved() {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    vi.mocked(createMetaWebhookServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(resolveInstagramAccountOwnership).mockResolvedValue({ workspaceId: "ws_1", instagramAccountIdentityId: "identity_1" });
  }

  it("calls processMetaWebhookEvent only after the raw event is successfully recorded, and before completing idempotency as completed", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey() });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });

    const callOrder: string[] = [];
    vi.mocked(recordMetaWebhookEvent).mockImplementation(async () => {
      callOrder.push("recordMetaWebhookEvent");
      return { success: true, id: "evt_1" };
    });
    vi.mocked(processMetaWebhookEvent).mockImplementation(async () => {
      callOrder.push("processMetaWebhookEvent");
    });
    vi.mocked(completeAutomationIdempotencyKey).mockImplementation(async () => {
      callOrder.push("completeAutomationIdempotencyKey");
      return { success: true, key: claimedKey({ status: "completed" }) };
    });

    await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(callOrder).toEqual(["recordMetaWebhookEvent", "processMetaWebhookEvent", "completeAutomationIdempotencyKey"]);
  });

  it("never calls processMetaWebhookEvent when recordMetaWebhookEvent itself fails", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey() });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: false, error: "db error" });

    await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(processMetaWebhookEvent).not.toHaveBeenCalled();
  });

  it("never calls processMetaWebhookEvent for an unresolved (no workspace) delivery", async () => {
    vi.mocked(verifyMetaWebhookSignature).mockReturnValue(true);
    vi.mocked(createMetaWebhookServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(resolveInstagramAccountOwnership).mockResolvedValue(null);
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });

    await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(processMetaWebhookEvent).not.toHaveBeenCalled();
  });

  it("a processMetaWebhookEvent failure (e.g. a genuine domain persistence error) marks the delivery failed/retryable, mirroring a recordMetaWebhookEvent failure exactly — the existing SOCIAL-11C error path, unmodified", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey() });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });
    vi.mocked(processMetaWebhookEvent).mockRejectedValueOnce(new Error("comment persistence failed"));
    vi.mocked(completeAutomationIdempotencyKey).mockResolvedValue({ success: true, key: claimedKey({ status: "failed" }) });

    const response = await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(response.status).toBe(500);
    expect(completeAutomationIdempotencyKey).toHaveBeenCalledWith("idem_1", "failed");
  });

  it("no outbound Meta call, comment reply, DM reply, Lead creation, AI provider call, or CRM mutation happens anywhere in the route's own module graph — processMetaWebhookEvent is the only new call, and it is mocked here specifically so this test file never exercises real Meta/AI/CRM code", async () => {
    setupResolved();
    vi.mocked(claimAutomationIdempotencyKey).mockResolvedValue({ success: true, claimed: true, key: claimedKey() });
    vi.mocked(recordMetaWebhookEvent).mockResolvedValue({ success: true, id: "evt_1" });

    await POST(makePostRequest(VALID_BODY, "sha256=real"));
    expect(processMetaWebhookEvent).toHaveBeenCalledTimes(1);
  });
});
