import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { supabaseAIGenerationRepository } from "@/lib/data/aiGeneration/supabaseRepository";
import { createClient } from "@/lib/supabase/client";
import type { CreateAIGenerationInput } from "@/types/aiGeneration";

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
    b.is = chain("is");
    b.not = chain("not");
    b.order = chain("order");
    b.range = chain("range");
    b.limit = (...args: unknown[]) => {
      calls.push({ table, method: "limit", args });
      return nextResult();
    };
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

function generationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "generation_1",
    workspace_id: "ws_1",
    source_entity_type: "idea_item",
    source_entity_id: "idea_1",
    use_case_id: "hook-suggestions",
    skill_id: "hook-suggestions-skill",
    generation_number: 1,
    input: { title: "A cozy autumn wedding" },
    output: { hooks: ["Fall in love with fall weddings."] },
    provider_id: "mock-provider",
    model: "mock-model",
    prompt_version: "v1",
    is_mock: true,
    latency_ms: 120,
    confidence: 80,
    approval_status: "proposed",
    reviewed_by: null,
    reviewed_at: null,
    archived_at: null,
    created_by: "11111111-1111-4111-8111-111111111111",
    created_at: "2026-09-23T00:00:00Z",
    updated_at: "2026-09-23T00:00:00Z",
    ...overrides,
  };
}

function createInput(overrides: Partial<CreateAIGenerationInput> = {}): CreateAIGenerationInput {
  return {
    workspaceId: "ws_1",
    createdBy: "11111111-1111-4111-8111-111111111111",
    sourceEntityType: "idea_item",
    sourceEntityId: "idea_1",
    useCaseId: "hook-suggestions",
    skillId: "hook-suggestions-skill",
    input: { title: "A cozy autumn wedding" },
    output: { hooks: ["Fall in love with fall weddings."] },
    providerId: "mock-provider",
    model: "mock-model",
    promptVersion: "v1",
    isMock: true,
    latencyMs: 120,
    confidence: 80,
    ...overrides,
  };
}

describe("supabaseAIGenerationRepository — createAIGeneration", () => {
  it("queries the current max generation_number, then inserts with the next number", async () => {
    const { client, calls } = createMockSupabase([
      { data: [{ generation_number: 3 }], error: null },
      { data: generationRow({ generation_number: 4 }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.createAIGeneration(createInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.generation_number).toBe(4);

    const insertCall = calls.find((c) => c.method === "insert");
    expect(insertCall?.args[0]).toMatchObject({ generation_number: 4, source_entity_type: "idea_item", source_entity_id: "idea_1", use_case_id: "hook-suggestions" });
  });

  it("assigns generation_number 1 when no prior generation exists for this pair", async () => {
    const { client } = createMockSupabase([
      { data: [], error: null },
      { data: generationRow({ generation_number: 1 }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.createAIGeneration(createInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.generation_number).toBe(1);
  });

  it("returns a controlled error on a unique-constraint race (23505), never a raw Postgres error", async () => {
    const { client } = createMockSupabase([
      { data: [], error: null },
      { data: null, error: { code: "23505", message: "duplicate key value" } },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.createAIGeneration(createInput());
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).not.toContain("duplicate key");
    expect(result.error).not.toContain("23505");
  });

  it("never persists a provider credential of any kind — the insert payload only ever carries provider_id/model/prompt_version, no api key field", async () => {
    const { client, calls } = createMockSupabase([
      { data: [], error: null },
      { data: generationRow(), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await supabaseAIGenerationRepository.createAIGeneration(createInput());
    const insertCall = calls.find((c) => c.method === "insert");
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(Object.keys(payload)).not.toContain("api_key");
    expect(Object.keys(payload)).not.toContain("secret");
    expect(Object.keys(payload)).not.toContain("token");
  });
});

describe("supabaseAIGenerationRepository — getAIGenerationById", () => {
  it("throws for a nonexistent id", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    await expect(supabaseAIGenerationRepository.getAIGenerationById("missing")).rejects.toThrow();
  });

  it("maps a found row to the domain shape", async () => {
    const { client } = createMockSupabase([{ data: generationRow(), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.getAIGenerationById("generation_1");
    expect(result.id).toBe("generation_1");
    expect(result.approval_status).toBe("proposed");
  });
});

describe("supabaseAIGenerationRepository — approve/reject", () => {
  it("rejects approving when the generation could not be found", async () => {
    const { client } = createMockSupabase([{ data: null, error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.approveAIGeneration("missing", "reviewer_1");
    expect(result.success).toBe(false);
  });

  it("rejects approving an already-reviewed generation", async () => {
    const { client } = createMockSupabase([{ data: generationRow({ approval_status: "approved", reviewed_by: "someone", reviewed_at: "2026-09-23T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.approveAIGeneration("generation_1", "reviewer_1");
    expect(result.success).toBe(false);
  });

  it("stamps reviewed_by/reviewed_at on approve", async () => {
    const { client, calls } = createMockSupabase([
      { data: generationRow(), error: null },
      { data: generationRow({ approval_status: "approved", reviewed_by: "reviewer_1", reviewed_at: "2026-09-23T01:00:00Z" }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.approveAIGeneration("generation_1", "reviewer_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.approval_status).toBe("approved");
    expect(result.data.reviewed_by).toBe("reviewer_1");

    const updateCall = calls.find((c) => c.method === "update");
    expect(updateCall?.args[0]).toMatchObject({ approval_status: "approved", reviewed_by: "reviewer_1" });
  });
});

describe("supabaseAIGenerationRepository — archive/unarchive", () => {
  it("archive is idempotent — returns the existing row unchanged if already archived", async () => {
    const { client, calls } = createMockSupabase([{ data: generationRow({ archived_at: "2026-09-23T00:00:00Z" }), error: null }]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.archiveAIGeneration("generation_1");
    expect(result.success).toBe(true);
    expect(calls.find((c) => c.method === "update")).toBeUndefined();
  });

  it("unarchive clears archived_at", async () => {
    const { client } = createMockSupabase([
      { data: generationRow({ archived_at: "2026-09-23T00:00:00Z" }), error: null },
      { data: generationRow({ archived_at: null }), error: null },
    ]);
    vi.mocked(createClient).mockReturnValue(client as never);

    const result = await supabaseAIGenerationRepository.unarchiveAIGeneration("generation_1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).toBeNull();
  });
});
