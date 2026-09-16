import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return { ...actual, getDataMode: () => "supabase" as const };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { fetchSocialStrategistMaterials } from "@/modules/ai/socialStrategist/fetchSocialStrategistContext.server";
import { createClient } from "@/lib/supabase/server";

type QueryResult = { data: unknown; error: unknown };
type RecordedCall = { table: string; method: string; args: unknown[] };

/**
 * Same query-builder stub shape `supabaseRepository.test.ts` files across
 * this codebase already use — records every chained call, resolves via
 * `.then()` (how the real supabase-js query builder is awaited without an
 * explicit terminal method).
 */
function createMockSupabase(responsesByTable: Record<string, QueryResult>) {
  const calls: RecordedCall[] = [];
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
    b.in = chain("in");
    b.is = chain("is");
    b.order = chain("order");
    b.limit = chain("limit");
    b.then = (resolve: (value: QueryResult) => void) => {
      calls.push({ table, method: "then", args: [] });
      resolve(responsesByTable[table] ?? { data: [], error: null });
    };
    return b;
  }
  const client = { from: (table: string) => builder(table) };
  return { client, calls };
}

describe("fetchSocialStrategistMaterials — supabase mode, social_posts", () => {
  it("scopes the social_posts query to the given workspace, ordered newest-first, with a safety limit", async () => {
    const { client, calls } = createMockSupabase({});
    vi.mocked(createClient).mockResolvedValue(client as never);

    await fetchSocialStrategistMaterials("ws_1");

    const postsCalls = calls.filter((c) => c.table === "social_posts");
    expect(postsCalls.find((c) => c.method === "eq")?.args).toEqual(["workspace_id", "ws_1"]);
    expect(postsCalls.find((c) => c.method === "order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(postsCalls.find((c) => c.method === "limit")).toBeDefined();
  });
});

describe("fetchSocialStrategistMaterials — supabase mode, leads (Instagram-sourced only)", () => {
  it("scopes the leads query to the given workspace AND source = 'Instagram', never all Leads", async () => {
    const { client, calls } = createMockSupabase({});
    vi.mocked(createClient).mockResolvedValue(client as never);

    await fetchSocialStrategistMaterials("ws_1");

    const leadsCalls = calls.filter((c) => c.table === "leads");
    const eqArgs = leadsCalls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["workspace_id", "ws_1"]);
    expect(eqArgs).toContainEqual(["source", "Instagram"]);
  });

  it("a different workspaceId produces an independently-scoped leads query — never a cross-workspace read", async () => {
    const { client, calls } = createMockSupabase({});
    vi.mocked(createClient).mockResolvedValue(client as never);

    await fetchSocialStrategistMaterials("ws_other");

    const leadsCalls = calls.filter((c) => c.table === "leads");
    const eqArgs = leadsCalls.filter((c) => c.method === "eq").map((c) => c.args);
    expect(eqArgs).toContainEqual(["workspace_id", "ws_other"]);
  });
});

describe("fetchSocialStrategistMaterials — supabase mode, content libraries scope by workspace and exclude archived", () => {
  it("idea_items/inspiration_items/script_items/carousel_items are all workspace-scoped and archived_at-is-null filtered", async () => {
    const { client, calls } = createMockSupabase({});
    vi.mocked(createClient).mockResolvedValue(client as never);

    await fetchSocialStrategistMaterials("ws_1");

    for (const table of ["idea_items", "inspiration_items", "script_items", "carousel_items"]) {
      const tableCalls = calls.filter((c) => c.table === table);
      const eqArgs = tableCalls.filter((c) => c.method === "eq").map((c) => c.args);
      const isArgs = tableCalls.filter((c) => c.method === "is").map((c) => c.args);
      expect(eqArgs).toContainEqual(["workspace_id", "ws_1"]);
      expect(isArgs).toContainEqual(["archived_at", null]);
    }
  });
});

describe("fetchSocialStrategistMaterials — supabase mode, no service-role client anywhere", () => {
  it("only ever calls the ordinary server-session client (@/lib/supabase/server's createClient), never a service-role client", async () => {
    const { client } = createMockSupabase({});
    vi.mocked(createClient).mockResolvedValue(client as never);

    await fetchSocialStrategistMaterials("ws_1");

    expect(createClient).toHaveBeenCalled();
  });
});
