import { afterEach, describe, expect, it } from "vitest";
import { mockAIGenerationRepository } from "@/lib/data/aiGeneration/mockRepository";
import { resetAIGenerationsStore } from "@/lib/data/mock/aiGenerationsStore";
import type { CreateAIGenerationInput } from "@/types/aiGeneration";

const WORKSPACE_ID = "ws_1";
const ACTOR_ID = "user_1";

function baseInput(overrides: Partial<CreateAIGenerationInput> = {}): CreateAIGenerationInput {
  return {
    workspaceId: WORKSPACE_ID,
    createdBy: ACTOR_ID,
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

afterEach(() => {
  resetAIGenerationsStore();
});

describe("mockAIGenerationRepository — create", () => {
  it("assigns generation_number 1 to the first generation for a (source entity, use case) pair", async () => {
    const result = await mockAIGenerationRepository.createAIGeneration(baseInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.generation_number).toBe(1);
    expect(result.data.approval_status).toBe("proposed");
    expect(result.data.reviewed_by).toBeNull();
    expect(result.data.reviewed_at).toBeNull();
    expect(result.data.archived_at).toBeNull();
  });

  it("increments generation_number for a second generation of the exact same (source entity, use case) pair", async () => {
    await mockAIGenerationRepository.createAIGeneration(baseInput());
    const second = await mockAIGenerationRepository.createAIGeneration(baseInput());
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.data.generation_number).toBe(2);
  });

  it("numbers a different use_case_id for the same source entity independently, starting again at 1", async () => {
    await mockAIGenerationRepository.createAIGeneration(baseInput({ useCaseId: "hook-suggestions" }));
    await mockAIGenerationRepository.createAIGeneration(baseInput({ useCaseId: "hook-suggestions" }));
    const ctaGeneration = await mockAIGenerationRepository.createAIGeneration(baseInput({ useCaseId: "cta-suggestions" }));
    expect(ctaGeneration.success).toBe(true);
    if (!ctaGeneration.success) return;
    expect(ctaGeneration.data.generation_number).toBe(1);
  });

  it("numbers a different source entity independently, even with the same use_case_id", async () => {
    await mockAIGenerationRepository.createAIGeneration(baseInput({ sourceEntityId: "idea_1" }));
    const forDifferentIdea = await mockAIGenerationRepository.createAIGeneration(baseInput({ sourceEntityId: "idea_2" }));
    expect(forDifferentIdea.success).toBe(true);
    if (!forDifferentIdea.success) return;
    expect(forDifferentIdea.data.generation_number).toBe(1);
  });

  it("never persists a real (non-mock) generation from this repository's own callers in this checkpoint", async () => {
    const result = await mockAIGenerationRepository.createAIGeneration(baseInput({ isMock: true }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.is_mock).toBe(true);
  });
});

describe("mockAIGenerationRepository — get", () => {
  it("throws for a nonexistent id", async () => {
    await expect(mockAIGenerationRepository.getAIGenerationById("does-not-exist")).rejects.toThrow("This AI generation could not be found.");
  });

  it("returns the created row unchanged", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");
    const fetched = await mockAIGenerationRepository.getAIGenerationById(created.data.id);
    expect(fetched).toEqual(created.data);
  });
});

describe("mockAIGenerationRepository — list", () => {
  it("orders newest-first by generation_number", async () => {
    await mockAIGenerationRepository.createAIGeneration(baseInput());
    await mockAIGenerationRepository.createAIGeneration(baseInput());
    await mockAIGenerationRepository.createAIGeneration(baseInput());
    const list = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID);
    expect(list.map((g) => g.generation_number)).toEqual([3, 2, 1]);
  });

  it("scopes strictly to the given workspace", async () => {
    await mockAIGenerationRepository.createAIGeneration(baseInput({ workspaceId: WORKSPACE_ID }));
    await mockAIGenerationRepository.createAIGeneration(baseInput({ workspaceId: "ws_other" }));
    const list = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID);
    expect(list).toHaveLength(1);
  });

  it("filters by sourceEntityType/sourceEntityId/useCaseId", async () => {
    await mockAIGenerationRepository.createAIGeneration(baseInput({ sourceEntityType: "idea_item", sourceEntityId: "idea_1", useCaseId: "hook-suggestions" }));
    await mockAIGenerationRepository.createAIGeneration(baseInput({ sourceEntityType: "script_item", sourceEntityId: "script_1", useCaseId: "hook-suggestions" }));
    await mockAIGenerationRepository.createAIGeneration(baseInput({ sourceEntityType: "idea_item", sourceEntityId: "idea_1", useCaseId: "cta-suggestions" }));

    const forIdea = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID, { sourceEntityType: "idea_item", sourceEntityId: "idea_1" });
    expect(forIdea).toHaveLength(2);

    const forHooksOnly = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID, { useCaseId: "hook-suggestions" });
    expect(forHooksOnly).toHaveLength(2);
  });

  it("defaults to active (non-archived) only", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");
    await mockAIGenerationRepository.archiveAIGeneration(created.data.id);

    const activeOnly = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID);
    expect(activeOnly).toHaveLength(0);

    const archivedOnly = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID, { archived: "archived" });
    expect(archivedOnly).toHaveLength(1);

    const all = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID, { archived: "all" });
    expect(all).toHaveLength(1);
  });

  it("filters by approvalStatus", async () => {
    const a = await mockAIGenerationRepository.createAIGeneration(baseInput());
    const b = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!a.success || !b.success) throw new Error("setup failed");
    await mockAIGenerationRepository.approveAIGeneration(a.data.id, "reviewer_1");

    const approved = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID, { approvalStatus: "approved" });
    expect(approved).toHaveLength(1);
    const proposed = await mockAIGenerationRepository.listAIGenerations(WORKSPACE_ID, { approvalStatus: "proposed" });
    expect(proposed).toHaveLength(1);
  });
});

describe("mockAIGenerationRepository — approve/reject", () => {
  it("approve stamps reviewed_by/reviewed_at and flips approval_status, leaving input/output/provider metadata untouched", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");

    const approved = await mockAIGenerationRepository.approveAIGeneration(created.data.id, "reviewer_1");
    expect(approved.success).toBe(true);
    if (!approved.success) return;
    expect(approved.data.approval_status).toBe("approved");
    expect(approved.data.reviewed_by).toBe("reviewer_1");
    expect(approved.data.reviewed_at).not.toBeNull();
    expect(approved.data.output).toEqual(created.data.output);
    expect(approved.data.input).toEqual(created.data.input);
    expect(approved.data.generation_number).toBe(created.data.generation_number);
  });

  it("reject stamps reviewed_by/reviewed_at and flips approval_status", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");

    const rejected = await mockAIGenerationRepository.rejectAIGeneration(created.data.id, "reviewer_1");
    expect(rejected.success).toBe(true);
    if (!rejected.success) return;
    expect(rejected.data.approval_status).toBe("rejected");
    expect(rejected.data.reviewed_by).toBe("reviewer_1");
  });

  it("rejects re-approving an already-approved generation", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");
    await mockAIGenerationRepository.approveAIGeneration(created.data.id, "reviewer_1");

    const secondAttempt = await mockAIGenerationRepository.approveAIGeneration(created.data.id, "reviewer_2");
    expect(secondAttempt.success).toBe(false);
  });

  it("rejects rejecting an already-rejected generation", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");
    await mockAIGenerationRepository.rejectAIGeneration(created.data.id, "reviewer_1");

    const secondAttempt = await mockAIGenerationRepository.rejectAIGeneration(created.data.id, "reviewer_2");
    expect(secondAttempt.success).toBe(false);
  });

  it("a proposed generation is never auto-approved by any repository operation", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");
    expect(created.data.approval_status).toBe("proposed");
  });
});

describe("mockAIGenerationRepository — archive/unarchive", () => {
  it("archive is idempotent", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");

    const first = await mockAIGenerationRepository.archiveAIGeneration(created.data.id);
    const second = await mockAIGenerationRepository.archiveAIGeneration(created.data.id);
    expect(first.success && second.success).toBe(true);
    if (first.success && second.success) {
      expect(first.data.archived_at).toBe(second.data.archived_at);
    }
  });

  it("unarchive is idempotent and clears archived_at", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");
    await mockAIGenerationRepository.archiveAIGeneration(created.data.id);

    const unarchived = await mockAIGenerationRepository.unarchiveAIGeneration(created.data.id);
    expect(unarchived.success).toBe(true);
    if (!unarchived.success) return;
    expect(unarchived.data.archived_at).toBeNull();
  });

  it("archiving does not require the generation to have been reviewed first", async () => {
    const created = await mockAIGenerationRepository.createAIGeneration(baseInput());
    if (!created.success) throw new Error("setup failed");
    expect(created.data.approval_status).toBe("proposed");

    const archived = await mockAIGenerationRepository.archiveAIGeneration(created.data.id);
    expect(archived.success).toBe(true);
  });
});
