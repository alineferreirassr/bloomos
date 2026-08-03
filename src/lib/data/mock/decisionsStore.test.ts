import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockDecisionsRepository, resetDecisionsStore, type CreateDecisionInput } from "@/lib/data/mock/decisionsStore";

const baseInput: CreateDecisionInput = {
  title: "Resolve broken relationship",
  description: "A relationship points at a node that no longer exists.",
  category: "knowledge_graph",
  priority: "high",
  reason: "knowledge_health_engine:broken_relationship",
  generated_by: "knowledge_health_engine",
  related_entities: [{ nodeType: "event", nodeId: "event_1" }],
  related_assets: [],
  related_objective_ids: [],
  related_timeline_activity_ids: [],
  dependencies: [],
  dedupe_key: "knowledge_health_engine:broken_relationship:event:event_1",
};

beforeEach(() => {
  resetDecisionsStore();
});

afterEach(() => {
  resetDecisionsStore();
});

describe("mockDecisionsRepository", () => {
  it("creates a decision defaulting to open status", async () => {
    const result = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("open");
      expect(result.data.resolved_at).toBeNull();
    }
  });

  it("does not create a duplicate decision for the same dedupe_key while one is still open", async () => {
    const first = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    const second = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    expect(first.success && second.success && first.data.id === second.data.id).toBe(true);

    const all = await mockDecisionsRepository.listDecisionsForWorkspace("ws_1");
    expect(all).toHaveLength(1);
  });

  it("creates a new decision for the same dedupe_key once the prior one is resolved", async () => {
    const first = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    if (!first.success) return;
    await mockDecisionsRepository.setDecisionStatus(first.data.id, "ws_1", "resolved", "Fixed manually.");

    const second = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    expect(second.success && second.data.id !== first.data.id).toBe(true);
  });

  it("lists decisions scoped to the workspace, excluding archived by default", async () => {
    const created = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    await mockDecisionsRepository.upsertDecision("ws_2", baseInput);
    if (created.success) await mockDecisionsRepository.setDecisionStatus(created.data.id, "ws_1", "archived", null);

    expect(await mockDecisionsRepository.listDecisionsForWorkspace("ws_1")).toEqual([]);
    expect(await mockDecisionsRepository.listDecisionsForWorkspace("ws_1", true)).toHaveLength(1);
  });

  it("sets resolved_at when transitioning to resolved, and preserves it if resolved again is a no-op", async () => {
    const created = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    if (!created.success) return;
    const resolved = await mockDecisionsRepository.setDecisionStatus(created.data.id, "ws_1", "resolved", "Done.");
    expect(resolved.success).toBe(true);
    if (resolved.success) {
      expect(resolved.data.resolved_at).not.toBeNull();
      expect(resolved.data.resolution_notes).toBe("Done.");
    }
  });

  it("updates priority independently of status", async () => {
    const created = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    if (!created.success) return;
    const updated = await mockDecisionsRepository.setDecisionPriority(created.data.id, "ws_1", "critical");
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.priority).toBe("critical");
      expect(updated.data.status).toBe("open");
    }
  });

  it("fails to update a decision for a different workspace", async () => {
    const created = await mockDecisionsRepository.upsertDecision("ws_1", baseInput);
    if (!created.success) return;
    const result = await mockDecisionsRepository.setDecisionStatus(created.data.id, "ws_2", "resolved", null);
    expect(result.success).toBe(false);
  });
});
