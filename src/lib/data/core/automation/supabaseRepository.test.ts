import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseAutomationRepository } from "@/lib/data/core/automation/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { RecordAutomationExecutionInput } from "@/types/automation";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

function createMockSupabase(responses: QueryResult[]) {
  const calls: RecordedCall[] = [];
  let i = 0;
  function nextResult(): QueryResult {
    if (i >= responses.length) throw new Error(`No mock Supabase response queued for call #${i + 1}`);
    return responses[i++];
  }
  function builder(table: string) {
    const b: Record<string, unknown> = {};
    const chain =
      (method: string) =>
      (...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      };
    b.select = chain("select");
    b.insert = chain("insert");
    b.update = chain("update");
    b.upsert = chain("upsert");
    b.eq = chain("eq");
    b.order = chain("order");
    b.limit = chain("limit");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return nextResult();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(nextResult());
    };
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  return { client, calls };
}

function executionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "automation_execution_1",
    workspace_id: "ws_1",
    automation_id: "automation_1",
    automation_name: "Stub Automation",
    automation_version: "v1",
    trigger_type: "event.created",
    trigger_facts: {},
    conditions_passed: true,
    approval_status: "not_required",
    approved_by: null,
    approved_at: null,
    action_results: [],
    status: "success",
    duration_ms: 5,
    started_at: "2026-01-01T00:00:00.000Z",
    completed_at: "2026-01-01T00:00:00.005Z",
    started_by: null,
    updated_at: "2026-01-01T00:00:00.005Z",
    ...overrides,
  };
}

function stubInput(overrides: Partial<RecordAutomationExecutionInput> = {}): RecordAutomationExecutionInput {
  return {
    automationId: "automation_1",
    automationName: "Stub Automation",
    automationVersion: "v1",
    trigger: "event.created",
    triggerFacts: {},
    conditionsPassed: true,
    approvalStatus: "not_required",
    approvedBy: null,
    approvedAt: null,
    actionResults: [],
    status: "success",
    durationMs: 5,
    startedAt: "2026-01-01T00:00:00.000Z",
    completedAt: "2026-01-01T00:00:00.005Z",
    ...overrides,
  };
}

describe("supabaseAutomationRepository — automation_executions", () => {
  it("recordExecution inserts the expected payload and maps the returned row", async () => {
    const { client, calls } = createMockSupabase([{ data: executionRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAutomationRepository.recordExecution("ws_1", stubInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workspaceId).toBe("ws_1");
    expect(result.data.automationId).toBe("automation_1");

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ workspace_id: "ws_1", automation_id: "automation_1", trigger_type: "event.created", status: "success" });
  });

  it("getRecentExecutions scopes by workspace and orders newest first", async () => {
    const { client, calls } = createMockSupabase([{ data: [executionRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const results = await supabaseAutomationRepository.getRecentExecutions("ws_1", 10);
    expect(results).toHaveLength(1);
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["workspace_id", "ws_1"]);
    const orderCall = calls.find((c) => c.method === "order");
    expect(orderCall?.args).toEqual(["started_at", { ascending: false }]);
  });

  it("getExecutionById returns null when the row does not exist", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    expect(await supabaseAutomationRepository.getExecutionById("missing")).toBeNull();
  });

  it("getPendingApprovals filters on approval_status = 'pending'", async () => {
    const { client, calls } = createMockSupabase([{ data: [executionRow({ approval_status: "pending", status: "pending_approval" })], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const results = await supabaseAutomationRepository.getPendingApprovals("ws_1");
    expect(results).toHaveLength(1);
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["approval_status", "pending"]);
  });

  describe("approveExecution", () => {
    it("updates only approval_status/approved_by/approved_at — never status itself", async () => {
      const { client, calls } = createMockSupabase([
        { data: executionRow({ approval_status: "pending", status: "pending_approval" }), error: null },
        { data: executionRow({ approval_status: "approved", status: "pending_approval", approved_by: "approver_1" }), error: null },
      ]);
      vi.mocked(createClient).mockReturnValue(client as never);

      const result = await supabaseAutomationRepository.approveExecution("automation_execution_1", "approver_1");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.approvalStatus).toBe("approved");
      expect(result.data.status).toBe("pending_approval");

      const updateCall = calls.find((c) => c.method === "update");
      expect(updateCall?.args[0]).toEqual(expect.objectContaining({ approval_status: "approved", approved_by: "approver_1" }));
      expect(updateCall?.args[0]).not.toHaveProperty("status");
    });

    it("fails for an unknown execution id without ever calling update", async () => {
      const { client, calls } = createMockSupabase([{ data: null, error: null }]);
      vi.mocked(createClient).mockReturnValue(client as never);

      const result = await supabaseAutomationRepository.approveExecution("missing", "approver_1");
      expect(result.success).toBe(false);
      expect(calls.find((c) => c.method === "update")).toBeUndefined();
    });

    it("fails for an execution that isn't pending — never double-approve", async () => {
      const { client, calls } = createMockSupabase([{ data: executionRow({ approval_status: "approved", status: "success" }), error: null }]);
      vi.mocked(createClient).mockReturnValue(client as never);

      const result = await supabaseAutomationRepository.approveExecution("automation_execution_1", "approver_1");
      expect(result.success).toBe(false);
      expect(calls.find((c) => c.method === "update")).toBeUndefined();
    });
  });

  describe("rejectExecution", () => {
    it("sets approval_status='rejected' AND status='rejected'/completed_at — the one path that mutates status", async () => {
      const { client, calls } = createMockSupabase([
        { data: executionRow({ approval_status: "pending", status: "pending_approval" }), error: null },
        { data: executionRow({ approval_status: "rejected", status: "rejected", approved_by: "approver_1" }), error: null },
      ]);
      vi.mocked(createClient).mockReturnValue(client as never);

      const result = await supabaseAutomationRepository.rejectExecution("automation_execution_1", "approver_1");
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.status).toBe("rejected");

      const updateCall = calls.find((c) => c.method === "update");
      expect(updateCall?.args[0]).toEqual(expect.objectContaining({ approval_status: "rejected", status: "rejected" }));
      expect(updateCall?.args[0]).toHaveProperty("completed_at");
    });
  });
});

describe("supabaseAutomationRepository — automation_approval_overrides", () => {
  it("getApprovalOverride returns null when no override row exists", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    expect(await supabaseAutomationRepository.getApprovalOverride("ws_1", "automation_1")).toBeNull();
  });

  it("getApprovalOverride returns the stored boolean", async () => {
    const { client } = createMockSupabase([{ data: { required: false }, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    expect(await supabaseAutomationRepository.getApprovalOverride("ws_1", "automation_1")).toBe(false);
  });

  it("setApprovalOverride upserts on the (workspace_id, automation_id) natural key", async () => {
    const { client, calls } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAutomationRepository.setApprovalOverride("ws_1", "automation_1", true);
    expect(result.success).toBe(true);

    const upsertCall = calls.find((c) => c.method === "upsert");
    expect(upsertCall?.args[0]).toEqual({ workspace_id: "ws_1", automation_id: "automation_1", required: true });
    expect(upsertCall?.args[1]).toEqual({ onConflict: "workspace_id,automation_id" });
  });
});
