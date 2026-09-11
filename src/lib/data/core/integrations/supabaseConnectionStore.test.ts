import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getConnectionById, insertConnection, listConnectionsForWorkspace } from "@/lib/data/core/integrations/supabaseConnectionStore";
import type { IntegrationConnection } from "@/core/integrations/types";

type QueryResult = { data: unknown; error: unknown };

function mockSupabase(responses: QueryResult[]) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  let i = 0;
  function next(): QueryResult {
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
    b.eq = chain("eq");
    b.order = chain("order");
    b.insert = chain("insert");
    b.update = chain("update");
    b.delete = chain("delete");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return next();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return next();
    };
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(next());
    };
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  vi.mocked(createClient).mockResolvedValue(client as never);
  return { calls };
}

function connectionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "conn_1",
    workspace_id: "ws_1",
    member_id: null,
    provider_id: "gmail",
    state: "disconnected",
    config: {},
    credential_id: null,
    capabilities: ["oauth", "communication"],
    version: 1,
    installed_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    last_state_change_at: "2026-01-01T00:00:00.000Z",
    last_health_check_at: null,
    last_sync_at: null,
    failure_count: 0,
    retry_count: 0,
    ...overrides,
  };
}

const CONNECTION: IntegrationConnection = {
  id: "conn_1",
  workspace_id: "ws_1",
  member_id: "user_2",
  provider_id: "gmail",
  state: "disconnected",
  config: {},
  credential_id: null,
  capabilities: ["oauth", "communication"],
  version: 1,
  installed_by: "user_2",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  last_state_change_at: "2026-01-01T00:00:00.000Z",
  last_health_check_at: null,
  last_sync_at: null,
  failure_count: 0,
  retry_count: 0,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("supabaseConnectionStore", () => {
  it("insertConnection writes member_id for a member-owned connection", async () => {
    const { calls } = mockSupabase([{ data: connectionRow({ member_id: "user_2", installed_by: "user_2" }), error: null }]);

    const result = await insertConnection(CONNECTION);

    const insertCall = calls.find((c) => c.table === "integration_connections" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.member_id).toBe("user_2");
    expect(result.member_id).toBe("user_2");
  });

  it("GMAIL-CONNECTION-FIX-01 — never sends the client-generated placeholder id; integration_connections.id is a real Postgres uuid column with its own gen_random_uuid() default", async () => {
    const { calls } = mockSupabase([{ data: connectionRow({ id: "9f2c1a3e-1111-4b2b-8c3d-000000000001" }), error: null }]);

    await insertConnection({ ...CONNECTION, id: "integration-connection_not-a-real-uuid" });

    const insertCall = calls.find((c) => c.table === "integration_connections" && c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("id");
  });

  it("GMAIL-CONNECTION-FIX-01 — returns the database-generated uuid, never the client-supplied placeholder", async () => {
    mockSupabase([{ data: connectionRow({ id: "9f2c1a3e-1111-4b2b-8c3d-000000000001" }), error: null }]);

    const result = await insertConnection({ ...CONNECTION, id: "integration-connection_not-a-real-uuid" });

    expect(result.id).toBe("9f2c1a3e-1111-4b2b-8c3d-000000000001");
  });

  it("getConnectionById maps a workspace-owned row (null member_id) correctly", async () => {
    mockSupabase([{ data: connectionRow(), error: null }]);

    const result = await getConnectionById("conn_1");

    expect(result?.member_id).toBeNull();
    expect(result?.provider_id).toBe("gmail");
    expect(result?.capabilities).toEqual(["oauth", "communication"]);
  });

  it("listConnectionsForWorkspace maps every row in the result set", async () => {
    mockSupabase([{ data: [connectionRow({ id: "conn_1" }), connectionRow({ id: "conn_2", member_id: "user_3" })], error: null }]);

    const results = await listConnectionsForWorkspace("ws_1");

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("conn_1");
    expect(results[1].member_id).toBe("user_3");
  });
});
