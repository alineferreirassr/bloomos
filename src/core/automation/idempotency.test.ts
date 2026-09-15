import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/core/automation/automationServiceRole", () => ({
  createAutomationServiceRoleClient: vi.fn(),
}));

import { claimAutomationIdempotencyKey, completeAutomationIdempotencyKey } from "@/core/automation/idempotency";
import { createAutomationServiceRoleClient } from "@/core/automation/automationServiceRole";

function keyRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "idem_1",
    workspace_id: "ws_1",
    source: "meta_webhook",
    dedup_key: "delivery_123",
    status: "processing",
    execution_id: null,
    attempt_count: 1,
    claimed_at: "2026-01-01T00:00:00.000Z",
    completed_at: null,
    ...overrides,
  };
}

function mockClient(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { rpc };
}

describe("claimAutomationIdempotencyKey", () => {
  it("first write — the RPC returns one row, and the caller is told it now owns the claim", async () => {
    const client = mockClient({ data: [keyRow()], error: null });
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(client as never);

    const result = await claimAutomationIdempotencyKey("ws_1", "meta_webhook", "delivery_123");
    expect(result).toEqual({
      success: true,
      claimed: true,
      key: expect.objectContaining({ id: "idem_1", workspaceId: "ws_1", source: "meta_webhook", dedupKey: "delivery_123", status: "processing", attemptCount: 1 }),
    });
    expect(client.rpc).toHaveBeenCalledWith("claim_automation_idempotency_key", { p_workspace_id: "ws_1", p_source: "meta_webhook", p_dedup_key: "delivery_123" });
  });

  it("duplicate detection — the RPC returns zero rows (already processing/completed elsewhere), and the caller is told to skip", async () => {
    const client = mockClient({ data: [], error: null });
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(client as never);

    const result = await claimAutomationIdempotencyKey("ws_1", "meta_webhook", "delivery_123");
    expect(result).toEqual({ success: true, claimed: false });
  });

  it("re-claim after failure — the RPC returns the re-claimed row with an incremented attempt count", async () => {
    const client = mockClient({ data: [keyRow({ attempt_count: 2 })], error: null });
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(client as never);

    const result = await claimAutomationIdempotencyKey("ws_1", "meta_webhook", "delivery_123");
    expect(result.success && result.claimed && result.key.attemptCount).toBe(2);
  });

  it("returns a controlled error when the service-role credential is unavailable, never throwing", async () => {
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(null);

    const result = await claimAutomationIdempotencyKey("ws_1", "meta_webhook", "delivery_123");
    expect(result.success).toBe(false);
  });

  it("returns a controlled error when the RPC itself errors, never throwing", async () => {
    const client = mockClient({ data: null, error: { message: "db down" } });
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(client as never);

    const result = await claimAutomationIdempotencyKey("ws_1", "meta_webhook", "delivery_123");
    expect(result.success).toBe(false);
  });

  it("never leaks the service-role key or raw db error text into the returned error message", async () => {
    const client = mockClient({ data: null, error: { message: "service_role key abc123 rejected by db down" } });
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(client as never);

    const result = await claimAutomationIdempotencyKey("ws_1", "meta_webhook", "delivery_123");
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).not.toContain("abc123");
    expect(result.error).not.toContain("service_role key");
  });
});

describe("completeAutomationIdempotencyKey", () => {
  it("marks a key completed and links the execution id", async () => {
    const client = mockClient({ data: keyRow({ status: "completed", execution_id: "exec_1", completed_at: "2026-01-01T00:01:00.000Z" }), error: null });
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(client as never);

    const result = await completeAutomationIdempotencyKey("idem_1", "completed", "exec_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.key.status).toBe("completed");
    expect(result.key.executionId).toBe("exec_1");
    expect(client.rpc).toHaveBeenCalledWith("complete_automation_idempotency_key", { p_id: "idem_1", p_status: "completed", p_execution_id: "exec_1" });
  });

  it("marks a key failed, making it eligible for a future re-claim", async () => {
    const client = mockClient({ data: keyRow({ status: "failed", completed_at: "2026-01-01T00:01:00.000Z" }), error: null });
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(client as never);

    const result = await completeAutomationIdempotencyKey("idem_1", "failed");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.key.status).toBe("failed");
    expect(client.rpc).toHaveBeenCalledWith("complete_automation_idempotency_key", { p_id: "idem_1", p_status: "failed", p_execution_id: null });
  });

  it("returns a controlled error when the service-role credential is unavailable", async () => {
    vi.mocked(createAutomationServiceRoleClient).mockReturnValue(null);
    const result = await completeAutomationIdempotencyKey("idem_1", "failed");
    expect(result.success).toBe(false);
  });
});
