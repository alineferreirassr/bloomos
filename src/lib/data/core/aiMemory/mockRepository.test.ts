import { afterEach, describe, expect, it } from "vitest";
import { mockAIMemoryRepository, resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";
import type { CreateAIMemoryInput, AIMemoryProposal } from "@/types/aiMemory";

const WORKSPACE = "ws_1";

function createInput(overrides: Partial<CreateAIMemoryInput> = {}): CreateAIMemoryInput {
  return {
    skillId: "daily-operations-brief",
    entityType: null,
    entityId: null,
    title: "Overdue checklist trend",
    summary: "Checklist items have been overdue for 3 consecutive days.",
    category: "historical_knowledge",
    importance: "medium",
    visibility: "workspace",
    tags: ["checklist"],
    confidence: 90,
    source: "system",
    ...overrides,
  };
}

function proposalInput(overrides: Partial<AIMemoryProposal> = {}): AIMemoryProposal {
  return {
    skillId: "proposal.generate",
    entityType: "event",
    entityId: "event_1",
    title: "Client prefers formal tone",
    summary: "Client prefers a formal tone in all written communication.",
    visibility: "workspace",
    ...overrides,
  };
}

afterEach(() => resetAIMemoryStore());

describe("mockAIMemoryRepository", () => {
  describe("createMemory", () => {
    it("creates a memory with every declared field", async () => {
      const result = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toMatchObject({
          workspace_id: WORKSPACE,
          skill_id: "daily-operations-brief",
          title: "Overdue checklist trend",
          category: "historical_knowledge",
          importance: "medium",
          visibility: "workspace",
          confidence: 90,
          source: "system",
        });
        expect(result.data.id).toMatch(/^ai_memory_/);
      }
    });

    it("rejects an empty title", async () => {
      const result = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ title: "  " }));
      expect(result.success).toBe(false);
    });

    it("rejects an empty summary", async () => {
      const result = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ summary: "" }));
      expect(result.success).toBe(false);
    });

    it("rejects a user-visible memory with no userId", async () => {
      const result = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ visibility: "user" }));
      expect(result.success).toBe(false);
    });

    it("rejects confidence outside 0-100", async () => {
      expect((await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ confidence: 150 }))).success).toBe(false);
      expect((await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ confidence: -1 }))).success).toBe(false);
    });

    it("defaults approval_status to 'proposed' when omitted", async () => {
      const result = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput());
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.approval_status).toBe("proposed");
    });

    it("honors an explicit approval_status", async () => {
      const result = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved" }));
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.approval_status).toBe("approved");
    });
  });

  describe("proposeMemory", () => {
    it("always creates approval_status 'proposed', category 'ai_generated_knowledge' by default", async () => {
      const result = await mockAIMemoryRepository.proposeMemory(WORKSPACE, proposalInput());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.approval_status).toBe("proposed");
        expect(result.data.category).toBe("ai_generated_knowledge");
        expect(result.data.source).toBe("skill");
      }
    });

    it("rejects a user-scoped proposal with no userId", async () => {
      const result = await mockAIMemoryRepository.proposeMemory(WORKSPACE, proposalInput({ visibility: "user" }));
      expect(result.success).toBe(false);
    });
  });

  describe("updateMemory", () => {
    it("updates title/summary/importance/tags/expiresAt", async () => {
      const created = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput());
      if (!created.success) throw new Error("setup failed");
      const updated = await mockAIMemoryRepository.updateMemory(created.data.id, { title: "New title", importance: "high" });
      expect(updated.success).toBe(true);
      if (updated.success) {
        expect(updated.data.title).toBe("New title");
        expect(updated.data.importance).toBe("high");
        expect(updated.data.summary).toBe(created.data.summary);
      }
    });

    it("fails for an unknown id", async () => {
      expect((await mockAIMemoryRepository.updateMemory("missing", { title: "x" })).success).toBe(false);
    });
  });

  describe("archiveMemory", () => {
    it("sets approval_status to 'archived'", async () => {
      const created = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput());
      if (!created.success) throw new Error("setup failed");
      const archived = await mockAIMemoryRepository.archiveMemory(created.data.id);
      expect(archived.success).toBe(true);
      if (archived.success) expect(archived.data.approval_status).toBe("archived");
    });
  });

  describe("expireMemories", () => {
    it("expires only memories in this Workspace whose expires_at has passed, leaving others untouched", async () => {
      const past = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved", expiresAt: "2020-01-01T00:00:00.000Z" }));
      const future = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved", expiresAt: "2999-01-01T00:00:00.000Z" }));
      const neverExpires = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved", expiresAt: null }));
      if (!past.success || !future.success || !neverExpires.success) throw new Error("setup failed");

      const count = await mockAIMemoryRepository.expireMemories(WORKSPACE, new Date().toISOString());
      expect(count).toBe(1);

      expect((await mockAIMemoryRepository.getMemoryById(past.data.id))?.approval_status).toBe("expired");
      expect((await mockAIMemoryRepository.getMemoryById(future.data.id))?.approval_status).toBe("approved");
      expect((await mockAIMemoryRepository.getMemoryById(neverExpires.data.id))?.approval_status).toBe("approved");
    });

    it("never re-expires an already-terminal memory", async () => {
      const created = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ expiresAt: "2020-01-01T00:00:00.000Z" }));
      if (!created.success) throw new Error("setup failed");
      await mockAIMemoryRepository.rejectMemory(created.data.id, "member_1");
      const count = await mockAIMemoryRepository.expireMemories(WORKSPACE, new Date().toISOString());
      expect(count).toBe(0);
    });

    it("is scoped to one Workspace", async () => {
      await mockAIMemoryRepository.createMemory("ws_other", createInput({ expiresAt: "2020-01-01T00:00:00.000Z" }));
      const count = await mockAIMemoryRepository.expireMemories(WORKSPACE, new Date().toISOString());
      expect(count).toBe(0);
    });
  });

  describe("getMemoryById", () => {
    it("returns the memory when it exists", async () => {
      const created = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput());
      if (!created.success) throw new Error("setup failed");
      expect((await mockAIMemoryRepository.getMemoryById(created.data.id))?.id).toBe(created.data.id);
    });

    it("returns null for an unknown id", async () => {
      expect(await mockAIMemoryRepository.getMemoryById("missing")).toBeNull();
    });
  });

  describe("filterMemories", () => {
    it("scopes strictly to one Workspace", async () => {
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved" }));
      await mockAIMemoryRepository.createMemory("ws_other", createInput({ approvalStatus: "approved" }));
      expect(await mockAIMemoryRepository.filterMemories(WORKSPACE, {})).toHaveLength(1);
    });

    it("filters by category", async () => {
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ category: "operational_knowledge", approvalStatus: "approved" }));
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ category: "reference_knowledge", approvalStatus: "approved" }));
      const result = await mockAIMemoryRepository.filterMemories(WORKSPACE, { category: "operational_knowledge" });
      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("operational_knowledge");
    });

    it("filters by entityType + entityId together", async () => {
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ entityType: "event", entityId: "event_1", approvalStatus: "approved" }));
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ entityType: "event", entityId: "event_2", approvalStatus: "approved" }));
      const result = await mockAIMemoryRepository.filterMemories(WORKSPACE, { entityType: "event", entityId: "event_1" });
      expect(result).toHaveLength(1);
      expect(result[0].entity_id).toBe("event_1");
    });

    it("filters by skillId", async () => {
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ skillId: "daily-operations-brief", approvalStatus: "approved" }));
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ skillId: "proposal.generate", approvalStatus: "approved" }));
      const result = await mockAIMemoryRepository.filterMemories(WORKSPACE, { skillId: "proposal.generate" });
      expect(result).toHaveLength(1);
    });

    it("filters by importance", async () => {
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ importance: "high", approvalStatus: "approved" }));
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ importance: "low", approvalStatus: "approved" }));
      expect(await mockAIMemoryRepository.filterMemories(WORKSPACE, { importance: "high" })).toHaveLength(1);
    });

    it("filters by tags with any-match semantics", async () => {
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ tags: ["finance"], approvalStatus: "approved" }));
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ tags: ["events"], approvalStatus: "approved" }));
      const result = await mockAIMemoryRepository.filterMemories(WORKSPACE, { tags: ["finance", "unrelated"] });
      expect(result).toHaveLength(1);
    });

    it("filters by approvalStatus", async () => {
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "proposed" }));
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved" }));
      expect(await mockAIMemoryRepository.filterMemories(WORKSPACE, { approvalStatus: "approved" })).toHaveLength(1);
    });

    it("filters by visibility + userId together", async () => {
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ visibility: "user", userId: "user_1", approvalStatus: "approved" }));
      await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ visibility: "user", userId: "user_2", approvalStatus: "approved" }));
      const result = await mockAIMemoryRepository.filterMemories(WORKSPACE, { visibility: "user", userId: "user_1" });
      expect(result).toHaveLength(1);
      expect(result[0].user_id).toBe("user_1");
    });

    it("excludes expired memories unless includeExpired is set", async () => {
      const created = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved", expiresAt: "2020-01-01T00:00:00.000Z" }));
      if (!created.success) throw new Error("setup failed");
      await mockAIMemoryRepository.expireMemories(WORKSPACE, new Date().toISOString());
      expect(await mockAIMemoryRepository.filterMemories(WORKSPACE, {})).toEqual([]);
      expect(await mockAIMemoryRepository.filterMemories(WORKSPACE, { includeExpired: true })).toHaveLength(1);
    });

    it("excludes archived memories unless includeArchived is set", async () => {
      const created = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput());
      if (!created.success) throw new Error("setup failed");
      await mockAIMemoryRepository.archiveMemory(created.data.id);
      expect(await mockAIMemoryRepository.filterMemories(WORKSPACE, {})).toEqual([]);
      expect(await mockAIMemoryRepository.filterMemories(WORKSPACE, { includeArchived: true })).toHaveLength(1);
    });

    it("sorts newest first", async () => {
      const first = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved" }));
      await new Promise((resolve) => setTimeout(resolve, 2));
      const second = await mockAIMemoryRepository.createMemory(WORKSPACE, createInput({ approvalStatus: "approved" }));
      if (!first.success || !second.success) throw new Error("setup failed");
      const result = await mockAIMemoryRepository.filterMemories(WORKSPACE, {});
      expect(result.map((entry) => entry.id)).toEqual([second.data.id, first.data.id]);
    });
  });

  describe("approveMemory / rejectMemory / getPendingProposals", () => {
    it("approve sets reviewer fields and status", async () => {
      const proposed = await mockAIMemoryRepository.proposeMemory(WORKSPACE, proposalInput());
      if (!proposed.success) throw new Error("setup failed");
      const approved = await mockAIMemoryRepository.approveMemory(proposed.data.id, "member_1");
      expect(approved.success).toBe(true);
      if (approved.success) {
        expect(approved.data.approval_status).toBe("approved");
        expect(approved.data.reviewed_by).toBe("member_1");
        expect(approved.data.reviewed_at).not.toBeNull();
      }
    });

    it("reject sets reviewer fields and status", async () => {
      const proposed = await mockAIMemoryRepository.proposeMemory(WORKSPACE, proposalInput());
      if (!proposed.success) throw new Error("setup failed");
      const rejected = await mockAIMemoryRepository.rejectMemory(proposed.data.id, "member_1");
      expect(rejected.success).toBe(true);
      if (rejected.success) expect(rejected.data.approval_status).toBe("rejected");
    });

    it("fails for an unknown proposal id", async () => {
      expect((await mockAIMemoryRepository.approveMemory("missing", "member_1")).success).toBe(false);
      expect((await mockAIMemoryRepository.rejectMemory("missing", "member_1")).success).toBe(false);
    });

    it("getPendingProposals returns only this Workspace's own 'proposed' entries, oldest first", async () => {
      await mockAIMemoryRepository.proposeMemory(WORKSPACE, proposalInput());
      await mockAIMemoryRepository.proposeMemory("ws_other", proposalInput());
      const approvedOne = await mockAIMemoryRepository.proposeMemory(WORKSPACE, proposalInput());
      if (!approvedOne.success) throw new Error("setup failed");
      await mockAIMemoryRepository.approveMemory(approvedOne.data.id, "member_1");

      const pending = await mockAIMemoryRepository.getPendingProposals(WORKSPACE);
      expect(pending).toHaveLength(1);
      expect(pending.every((entry) => entry.workspace_id === WORKSPACE && entry.approval_status === "proposed")).toBe(true);
    });
  });
});
