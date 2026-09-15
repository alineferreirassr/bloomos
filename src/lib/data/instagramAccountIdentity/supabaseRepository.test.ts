import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseInstagramAccountIdentityRepository } from "@/lib/data/instagramAccountIdentity/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { UpsertInstagramAccountIdentityInput } from "@/lib/data/instagramAccountIdentity/repository";

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
    b.eq = chain("eq");
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

function identityRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "identity_1",
    workspace_id: "ws_1",
    connection_id: "connection_1",
    instagram_account_id: "17841400000000000",
    instagram_username: "amorebloomstudio",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function stubInput(overrides: Partial<UpsertInstagramAccountIdentityInput> = {}): UpsertInstagramAccountIdentityInput {
  return { workspaceId: "ws_1", connectionId: "connection_1", instagramAccountId: "17841400000000000", instagramUsername: "amorebloomstudio", ...overrides };
}

describe("supabaseInstagramAccountIdentityRepository", () => {
  it("creates a new identity when none exists for this external account", async () => {
    const { client, calls } = createMockSupabase([
      { data: null, error: null }, // lookup: none found
      { data: identityRow(), error: null }, // insert
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.workspace_id).toBe("ws_1");

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ workspace_id: "ws_1", connection_id: "connection_1", instagram_account_id: "17841400000000000" });
  });

  it("updates in place when the same workspace re-selects the same account", async () => {
    const { client, calls } = createMockSupabase([
      { data: identityRow({ instagram_username: "old_handle" }), error: null }, // lookup: existing, same workspace
      { data: identityRow({ instagram_username: "new_handle" }), error: null }, // update
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ instagramUsername: "new_handle" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.instagram_username).toBe("new_handle");
    expect(calls.find((c) => c.method === "insert")).toBeUndefined();
  });

  it("rejects claiming an account already connected to a different workspace — never calls insert or update", async () => {
    const { client, calls } = createMockSupabase([{ data: identityRow({ workspace_id: "ws_other" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseInstagramAccountIdentityRepository.upsertInstagramAccountIdentity(stubInput({ workspaceId: "ws_1" }));
    expect(result.success).toBe(false);
    expect(calls.find((c) => c.method === "insert")).toBeUndefined();
    expect(calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("listInstagramAccountIdentitiesForWorkspace filters by workspace_id", async () => {
    const { client, calls } = createMockSupabase([{ data: [identityRow()], error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const results = await supabaseInstagramAccountIdentityRepository.listInstagramAccountIdentitiesForWorkspace("ws_1");
    expect(results).toHaveLength(1);
    const eqCalls = calls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqCalls).toContainEqual(["workspace_id", "ws_1"]);
  });

  it("getInstagramAccountIdentityByExternalId returns null when no row matches", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    expect(await supabaseInstagramAccountIdentityRepository.getInstagramAccountIdentityByExternalId("missing")).toBeNull();
  });
});
