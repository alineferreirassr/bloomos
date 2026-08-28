import { describe, expect, it } from "vitest";
import { supabaseWellnessRepository } from "@/lib/data/wellness/supabaseRepository";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

/**
 * `supabaseWellnessRepository` takes its `ServerRepositoryContext` as a
 * direct parameter (never resolves it internally via a module-level auth
 * call), so it's testable in full isolation with a minimal stub Supabase
 * client — no `vi.mock` of any auth module needed, unlike client-resolved
 * repositories elsewhere in this codebase (e.g. `vendors/supabaseRepository.test.ts`).
 */
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
    b.eq = chain("eq");
    b.upsert = chain("upsert");
    b.update = chain("update");
    b.maybeSingle = async () => {
      calls.push({ table, method: "maybeSingle", args: [] });
      return nextResult();
    };
    b.single = async () => {
      calls.push({ table, method: "single", args: [] });
      return nextResult();
    };
    return b;
  }
  return { client: { from: (table: string) => builder(table) }, calls };
}

function makeContext(responses: QueryResult[]) {
  const { client, calls } = createMockSupabase(responses);
  const context = {
    supabase: client,
    session: {
      user: { id: "user_1" },
      workspace: { id: "workspace_1" },
    },
  } as unknown as ServerRepositoryContext;
  return { context, calls };
}

const CHECK_IN_ROW = {
  id: "checkin_1",
  workspace_id: "workspace_1",
  member_id: "user_1",
  checkin_date: "2026-08-27",
  mood: "calm",
  created_at: "2026-08-27T10:00:00Z",
  updated_at: "2026-08-27T10:00:00Z",
};

const WATER_ROW = {
  id: "water_1",
  workspace_id: "workspace_1",
  member_id: "user_1",
  log_date: "2026-08-27",
  glasses: 3,
  created_at: "2026-08-27T10:00:00Z",
  updated_at: "2026-08-27T10:00:00Z",
};

describe("supabaseWellnessRepository — mood check-in", () => {
  it("getMyCheckIn returns the mapped row scoped by member_id + checkin_date on the employee_wellness_checkins table", async () => {
    const { context, calls } = makeContext([{ data: CHECK_IN_ROW, error: null }]);
    const result = await supabaseWellnessRepository.getMyCheckIn("2026-08-27", context);
    expect(result).toEqual(CHECK_IN_ROW);
    expect(calls[0]).toEqual({ table: "employee_wellness_checkins", method: "select", args: ["*"] });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "member_id" && c.args[1] === "user_1")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "checkin_date" && c.args[1] === "2026-08-27")).toBe(true);
  });

  it("getMyCheckIn returns null when no row exists", async () => {
    const { context } = makeContext([{ data: null, error: null }]);
    const result = await supabaseWellnessRepository.getMyCheckIn("2026-08-27", context);
    expect(result).toBeNull();
  });

  it("getMyCheckIn throws a normalized error on a Supabase read failure", async () => {
    const { context } = makeContext([{ data: null, error: { message: "connection failed", code: "500" } }]);
    await expect(supabaseWellnessRepository.getMyCheckIn("2026-08-27", context)).rejects.toThrow();
  });

  it("setMyMood upserts scoped to the caller's own workspace_id + member_id and returns ok(mapped row)", async () => {
    const { context, calls } = makeContext([{ data: { ...CHECK_IN_ROW, mood: "happy" }, error: null }]);
    const result = await supabaseWellnessRepository.setMyMood("2026-08-27", "happy", context);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mood).toBe("happy");
    const upsertCall = calls.find((c) => c.method === "upsert");
    expect(upsertCall?.args[0]).toMatchObject({ workspace_id: "workspace_1", member_id: "user_1", checkin_date: "2026-08-27", mood: "happy" });
  });

  it("setMyMood returns a DataResult failure (does not throw) on a Supabase write failure", async () => {
    const { context } = makeContext([{ data: null, error: { message: "constraint violation", code: "23514" } }]);
    const result = await supabaseWellnessRepository.setMyMood("2026-08-27", "happy", context);
    expect(result.success).toBe(false);
  });
});

describe("supabaseWellnessRepository — water tracker", () => {
  it("getMyWaterLog returns the mapped row scoped by member_id + log_date on employee_water_logs", async () => {
    const { context, calls } = makeContext([{ data: WATER_ROW, error: null }]);
    const result = await supabaseWellnessRepository.getMyWaterLog("2026-08-27", context);
    expect(result).toEqual(WATER_ROW);
    expect(calls[0].table).toBe("employee_water_logs");
  });

  it("getMyWaterLog returns null when no row exists", async () => {
    const { context } = makeContext([{ data: null, error: null }]);
    const result = await supabaseWellnessRepository.getMyWaterLog("2026-08-27", context);
    expect(result).toBeNull();
  });

  it("addMyWaterGlass reads the current count then upserts count + 1, scoped to the caller", async () => {
    const { context, calls } = makeContext([
      { data: { glasses: 3 }, error: null },
      { data: { ...WATER_ROW, glasses: 4 }, error: null },
    ]);
    const result = await supabaseWellnessRepository.addMyWaterGlass("2026-08-27", context);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.glasses).toBe(4);
    const upsertCall = calls.find((c) => c.method === "upsert");
    expect(upsertCall?.args[0]).toMatchObject({ workspace_id: "workspace_1", member_id: "user_1", log_date: "2026-08-27", glasses: 4 });
  });

  it("addMyWaterGlass starts from 0 when no prior row exists", async () => {
    const { context } = makeContext([
      { data: null, error: null },
      { data: { ...WATER_ROW, glasses: 1 }, error: null },
    ]);
    const result = await supabaseWellnessRepository.addMyWaterGlass("2026-08-27", context);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.glasses).toBe(1);
  });

  it("addMyWaterGlass returns a failure (does not throw) if the read step errors", async () => {
    const { context } = makeContext([{ data: null, error: { message: "read failed", code: "500" } }]);
    const result = await supabaseWellnessRepository.addMyWaterGlass("2026-08-27", context);
    expect(result.success).toBe(false);
  });

  it("removeMyWaterGlass decrements the current count", async () => {
    const { context } = makeContext([
      { data: { glasses: 3 }, error: null },
      { data: { ...WATER_ROW, glasses: 2 }, error: null },
    ]);
    const result = await supabaseWellnessRepository.removeMyWaterGlass("2026-08-27", context);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.glasses).toBe(2);
  });

  it("removeMyWaterGlass fails honestly when there is nothing to remove", async () => {
    const { context } = makeContext([{ data: { glasses: 0 }, error: null }]);
    const result = await supabaseWellnessRepository.removeMyWaterGlass("2026-08-27", context);
    expect(result.success).toBe(false);
  });

  it("removeMyWaterGlass fails honestly when no row exists yet", async () => {
    const { context } = makeContext([{ data: null, error: null }]);
    const result = await supabaseWellnessRepository.removeMyWaterGlass("2026-08-27", context);
    expect(result.success).toBe(false);
  });
});
