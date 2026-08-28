import { describe, expect, it } from "vitest";
import { supabaseFounderNoteRepository } from "@/lib/data/founderNotes/supabaseRepository";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";

/**
 * Same directly-injected-context testing approach as
 * `wellness/supabaseRepository.test.ts` — no auth module mocking needed.
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
    b.order = chain("order");
    b.insert = chain("insert");
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

const NOTE_ROW = {
  id: "note_1",
  workspace_id: "workspace_1",
  author_id: "user_1",
  body: "Thank you for the flexibility this week.",
  created_at: "2026-08-27T10:00:00Z",
};

describe("supabaseFounderNoteRepository — getMyNotes", () => {
  it("lists only the caller's own notes, ordered newest first, on the notes_to_founder table", async () => {
    const { context, calls } = makeContext([{ data: [NOTE_ROW], error: null }]);
    const result = await supabaseFounderNoteRepository.getMyNotes(context);
    expect(result).toEqual([NOTE_ROW]);
    expect(calls[0]).toEqual({ table: "notes_to_founder", method: "select", args: ["*"] });
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "author_id" && c.args[1] === "user_1")).toBe(true);
    expect(calls.some((c) => c.method === "order" && c.args[0] === "created_at" && (c.args[1] as { ascending: boolean }).ascending === false)).toBe(true);
  });

  it("returns an empty array (never null/throw) when the caller has no notes yet", async () => {
    const { context } = makeContext([{ data: [], error: null }]);
    const result = await supabaseFounderNoteRepository.getMyNotes(context);
    expect(result).toEqual([]);
  });

  it("returns an empty array when Supabase responds with a null data payload", async () => {
    const { context } = makeContext([{ data: null, error: null }]);
    const result = await supabaseFounderNoteRepository.getMyNotes(context);
    expect(result).toEqual([]);
  });

  it("throws a normalized error on a Supabase read failure", async () => {
    const { context } = makeContext([{ data: null, error: { message: "connection failed", code: "500" } }]);
    await expect(supabaseFounderNoteRepository.getMyNotes(context)).rejects.toThrow();
  });
});

describe("supabaseFounderNoteRepository — createNote", () => {
  it("inserts scoped to the caller's own workspace_id + author_id and returns ok(mapped row)", async () => {
    const { context, calls } = makeContext([{ data: NOTE_ROW, error: null }]);
    const result = await supabaseFounderNoteRepository.createNote("Thank you for the flexibility this week.", context);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(NOTE_ROW);
    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toEqual({ workspace_id: "workspace_1", author_id: "user_1", body: "Thank you for the flexibility this week." });
  });

  it("trims the body before inserting", async () => {
    const { context, calls } = makeContext([{ data: NOTE_ROW, error: null }]);
    await supabaseFounderNoteRepository.createNote("   Thank you for the flexibility this week.   ", context);
    const insertCall = calls.find((c) => c.method === "insert");
    expect((insertCall?.args[0] as { body: string }).body).toBe("Thank you for the flexibility this week.");
  });

  it("rejects an empty/whitespace-only body without ever calling Supabase", async () => {
    const { context, calls } = makeContext([]);
    const result = await supabaseFounderNoteRepository.createNote("   ", context);
    expect(result.success).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("returns a DataResult failure (does not throw) on a Supabase write failure", async () => {
    const { context } = makeContext([{ data: null, error: { message: "insert failed", code: "500" } }]);
    const result = await supabaseFounderNoteRepository.createNote("A real note.", context);
    expect(result.success).toBe(false);
  });
});
