import { afterEach, describe, expect, it } from "vitest";
import { getMemoryManager } from "@/core/ai/memory/manager";
import { resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";

const manager = getMemoryManager();

afterEach(() => resetAIMemoryStore());

describe("AIMemoryManager.createMemory", () => {
  it("never writes anything for a failed Skill execution", async () => {
    const result = await manager.createMemory(
      "ws_1",
      {
        skillId: "proposal.generate",
        title: "Should never be written",
        summary: "A failed run has nothing worth remembering.",
        category: "operational_knowledge",
        importance: "medium",
        visibility: "workspace",
        confidence: 100,
        source: "system",
      },
      { skillExecutionStatus: "failure" },
    );

    expect(result.success).toBe(false);
    const all = await manager.filterMemories("ws_1", { includeExpired: true, includeArchived: true });
    expect(all).toHaveLength(0);
  });

  it("writes a memory for a successful execution, applying the approval-status policy when omitted", async () => {
    const result = await manager.createMemory(
      "ws_1",
      {
        skillId: "daily-operations-brief",
        title: "Daily Brief snapshot",
        summary: "[]",
        category: "historical_knowledge",
        importance: "low",
        visibility: "workspace",
        confidence: 100,
        source: "system",
      },
      { skillExecutionStatus: "success" },
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approval_status).toBe("approved");
      // Low importance, no explicit expiresAt — the policy's own 30-day default kicks in.
      expect(result.data.expires_at).not.toBeNull();
    }
  });

  it("respects an explicit expiresAt rather than overriding it with the importance-based policy default", async () => {
    const explicit = "2030-01-01T00:00:00.000Z";
    const result = await manager.createMemory("ws_1", {
      skillId: "daily-operations-brief",
      title: "Daily Brief snapshot",
      summary: "[]",
      category: "historical_knowledge",
      importance: "low",
      visibility: "workspace",
      confidence: 100,
      source: "system",
      expiresAt: explicit,
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.expires_at).toBe(explicit);
  });

  it("a Skill-sourced write still starts proposed even through the general createMemory path, not just proposeMemory", async () => {
    const result = await manager.createMemory("ws_1", {
      skillId: "proposal.generate",
      title: "An AI suggestion written directly",
      summary: "Still needs human review despite using createMemory.",
      category: "ai_generated_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 70,
      source: "skill",
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.approval_status).toBe("proposed");
  });
});

describe("AIMemoryManager.proposeMemory", () => {
  it("never proposes anything for a failed Skill execution", async () => {
    const result = await manager.proposeMemory(
      "ws_1",
      { skillId: "proposal.generate", title: "Should never be written", summary: "n/a", visibility: "workspace" },
      { skillExecutionStatus: "failure" },
    );
    expect(result.success).toBe(false);
  });
});

describe("AIMemoryManager approve/reject workflow", () => {
  it("approveMemory/rejectMemory record the reviewer and move the memory out of pendingProposals", async () => {
    const proposed = await manager.proposeMemory("ws_1", {
      skillId: "proposal.generate",
      title: "Suggested memory",
      summary: "A model's own suggestion.",
      visibility: "workspace",
    });
    expect(proposed.success).toBe(true);
    if (!proposed.success) return;

    const pendingBefore = await manager.getPendingProposals("ws_1");
    expect(pendingBefore.map((entry) => entry.id)).toContain(proposed.data.id);

    const approved = await manager.approveMemory(proposed.data.id, "member_1");
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.approval_status).toBe("approved");
      expect(approved.data.reviewed_by).toBe("member_1");
    }

    const pendingAfter = await manager.getPendingProposals("ws_1");
    expect(pendingAfter.map((entry) => entry.id)).not.toContain(proposed.data.id);
  });
});

describe("AIMemoryManager.lookupMemory / filterMemories / archiveMemory / expireStaleMemories", () => {
  it("lookupMemory finds a memory by id and returns null for an unknown one", async () => {
    const created = await manager.createMemory("ws_1", {
      skillId: null,
      title: "Findable",
      summary: "n/a",
      category: "reference_knowledge",
      importance: "high",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    expect((await manager.lookupMemory(created.data.id))?.id).toBe(created.data.id);
    expect(await manager.lookupMemory("no-such-id")).toBeNull();
  });

  it("archiveMemory moves a memory to a terminal, non-default-visible state", async () => {
    const created = await manager.createMemory("ws_1", {
      skillId: null,
      title: "To be archived",
      summary: "n/a",
      category: "workspace_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    await manager.archiveMemory(created.data.id);
    const visible = await manager.filterMemories("ws_1", {});
    expect(visible.map((entry) => entry.id)).not.toContain(created.data.id);
    const withArchived = await manager.filterMemories("ws_1", { includeArchived: true });
    expect(withArchived.map((entry) => entry.id)).toContain(created.data.id);
  });

  it("expireStaleMemories expires only this Workspace's own past-due memories", async () => {
    const past = "2000-01-01T00:00:00.000Z";
    await manager.createMemory("ws_1", {
      skillId: null,
      title: "Long expired",
      summary: "n/a",
      category: "historical_knowledge",
      importance: "low",
      visibility: "workspace",
      confidence: 100,
      source: "system",
      expiresAt: past,
    });
    await manager.createMemory("ws_other", {
      skillId: null,
      title: "Another Workspace's own expired entry",
      summary: "n/a",
      category: "historical_knowledge",
      importance: "low",
      visibility: "workspace",
      confidence: 100,
      source: "system",
      expiresAt: past,
    });

    const count = await manager.expireStaleMemories("ws_1", new Date());
    expect(count).toBe(1);

    const otherPending = await manager.filterMemories("ws_other", { includeExpired: true });
    expect(otherPending.find((entry) => entry.title === "Another Workspace's own expired entry")?.approval_status).not.toBe("expired");
  });
});

describe("AIMemoryManager.summarizeMemories", () => {
  it("aggregates totals by category, importance, and approval status", async () => {
    await manager.createMemory("ws_1", {
      skillId: null,
      title: "A",
      summary: "n/a",
      category: "reference_knowledge",
      importance: "high",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });
    await manager.createMemory("ws_1", {
      skillId: null,
      title: "B",
      summary: "n/a",
      category: "reference_knowledge",
      importance: "low",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });
    await manager.proposeMemory("ws_1", { skillId: "proposal.generate", title: "C", summary: "n/a", visibility: "workspace" });

    const summary = await manager.summarizeMemories("ws_1");
    expect(summary.totalCount).toBe(3);
    expect(summary.byCategory.reference_knowledge).toBe(2);
    expect(summary.byImportance.high).toBe(1);
    expect(summary.byImportance.low).toBe(1);
    expect(summary.approvedCount).toBe(2);
    expect(summary.pendingCount).toBe(1);
  });
});
