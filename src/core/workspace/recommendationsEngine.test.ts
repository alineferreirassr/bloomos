import { describe, expect, it } from "vitest";
import { topRecommendations } from "@/core/workspace/recommendationsEngine";
import type { WorkspaceRecommendation } from "@/types/smartWorkspace";

function decision(overrides: Partial<WorkspaceRecommendation> = {}): WorkspaceRecommendation {
  return {
    id: "decision_1",
    workspace_id: "ws_1",
    title: "Untitled",
    description: "",
    category: "operations",
    priority: "medium",
    status: "open",
    reason: "",
    generated_by: "test_engine",
    created_at: "2026-01-01T00:00:00Z",
    resolved_at: null,
    resolution_notes: null,
    related_entities: [],
    related_assets: [],
    related_objective_ids: [],
    related_timeline_activity_ids: [],
    dependencies: [],
    dedupe_key: `test:${overrides.id ?? "decision_1"}`,
    ...overrides,
  };
}

describe("recommendationsEngine.topRecommendations", () => {
  it("sorts by priority rank first (critical before informational)", () => {
    const queue = [decision({ id: "a", priority: "low" }), decision({ id: "b", priority: "critical" }), decision({ id: "c", priority: "medium" })];
    expect(topRecommendations(queue, 10).map((d) => d.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties on same priority by newest first", () => {
    const queue = [
      decision({ id: "old", priority: "high", created_at: "2026-01-01T00:00:00Z" }),
      decision({ id: "new", priority: "high", created_at: "2026-02-01T00:00:00Z" }),
    ];
    expect(topRecommendations(queue, 10).map((d) => d.id)).toEqual(["new", "old"]);
  });

  it("respects the limit", () => {
    const queue = [decision({ id: "a" }), decision({ id: "b" }), decision({ id: "c" })];
    expect(topRecommendations(queue, 2)).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const queue = [decision({ id: "a", priority: "low" }), decision({ id: "b", priority: "critical" })];
    const original = [...queue];
    topRecommendations(queue, 10);
    expect(queue).toEqual(original);
  });
});
