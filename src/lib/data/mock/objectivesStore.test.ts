import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockObjectivesRepository, resetObjectivesStore, type CreateObjectiveInput } from "@/lib/data/mock/objectivesStore";

const baseInput: CreateObjectiveInput = {
  scope: "event",
  node: { nodeType: "event", nodeId: "event_1" },
  title: "Event is fully ready",
  description: null,
  requirements: [],
  dependencies: [],
  due_date: null,
};

beforeEach(() => {
  resetObjectivesStore();
});

afterEach(() => {
  resetObjectivesStore();
});

describe("mockObjectivesRepository", () => {
  it("creates an objective defaulting to not_started status", async () => {
    const result = await mockObjectivesRepository.createObjective("ws_1", "member_1", baseInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("not_started");
    expect(result.data.archived_at).toBeNull();
  });

  it("rejects an objective with a blank title", async () => {
    const result = await mockObjectivesRepository.createObjective("ws_1", "member_1", { ...baseInput, title: "   " });
    expect(result.success).toBe(false);
  });

  it("lists objectives scoped to the workspace, excluding archived by default", async () => {
    const created = await mockObjectivesRepository.createObjective("ws_1", "member_1", baseInput);
    await mockObjectivesRepository.createObjective("ws_2", "member_1", baseInput);
    if (created.success) await mockObjectivesRepository.setObjectiveStatus(created.data.id, "ws_1", "archived");

    const active = await mockObjectivesRepository.listObjectivesForWorkspace("ws_1");
    expect(active).toEqual([]);

    const withArchived = await mockObjectivesRepository.listObjectivesForWorkspace("ws_1", true);
    expect(withArchived).toHaveLength(1);
  });

  it("sets archived_at when status transitions to archived", async () => {
    const created = await mockObjectivesRepository.createObjective("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const archived = await mockObjectivesRepository.setObjectiveStatus(created.data.id, "ws_1", "archived");
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();
  });

  it("fails to update a status for a different workspace's objective", async () => {
    const created = await mockObjectivesRepository.createObjective("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const result = await mockObjectivesRepository.setObjectiveStatus(created.data.id, "ws_2", "in_progress");
    expect(result.success).toBe(false);
  });

  it("updates title/description/requirements without touching status", async () => {
    const created = await mockObjectivesRepository.createObjective("ws_1", "member_1", baseInput);
    if (!created.success) return;
    const updated = await mockObjectivesRepository.updateObjective(created.data.id, "ws_1", { title: "Renamed" });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.title).toBe("Renamed");
      expect(updated.data.status).toBe("not_started");
    }
  });
});
