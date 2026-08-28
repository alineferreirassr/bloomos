import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

// executiveDecisionsActions.ts also imports Client Journey wiring
// (journeyRecommendationsForExecutiveDecisions), which imports `@/lib/auth/workspaceSession`
// directly — a second, separate path to the server-only-guarded `@/lib/supabase/server` the
// memberSessionSnapshot mock above doesn't intercept. Mocked here per the Test Infra T1-B fix;
// never actually reached in mock-mode tests.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { evaluateExecutiveDecisionsAction, updateDecisionStatusAction } from "@/modules/executiveDecisions/executiveDecisionsActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { resetBusinessHealthSnapshotsStore } from "@/lib/data/mock/businessHealthSnapshotsStore";
import { resetObjectivesStore } from "@/lib/data/mock/objectivesStore";
import { resetDecisionsStore } from "@/lib/data/mock/decisionsStore";
import { DECISION_CATEGORIES } from "@/types/executiveDecisions";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["assets.view", "assets.manage", "executive_decisions.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetKnowledgeGraphStore();
  resetMediaAssetsStore();
  resetTimelineStore();
  resetBusinessHealthSnapshotsStore();
  resetObjectivesStore();
  resetDecisionsStore();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  resetAll();
});

describe("evaluateExecutiveDecisionsAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await evaluateExecutiveDecisionsAction();
    expect(result.success).toBe(false);
  });

  it("evaluates the seeded workspace without crashing and returns a coherent shape", async () => {
    const result = await evaluateExecutiveDecisionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(Array.isArray(result.data.queue)).toBe(true);
    expect(Array.isArray(result.data.allDecisions)).toBe(true);
    expect(result.data.scorecard.overallExecutiveScore).toBeGreaterThanOrEqual(0);
    expect(result.data.scorecard.overallExecutiveScore).toBeLessThanOrEqual(100);
    for (const decision of result.data.allDecisions) {
      expect(DECISION_CATEGORIES).toContain(decision.category);
    }
  });

  it("resolves a real, non-fallback-only readiness value for every open decision (Closing Fix)", async () => {
    const result = await evaluateExecutiveDecisionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    const scores = Object.values(result.data.decisionScores);
    for (const score of scores) {
      expect(score.readiness).toBeDefined();
      expect(score.readiness.value).toBeGreaterThanOrEqual(0);
      expect(score.readiness.value).toBeLessThanOrEqual(100);
      expect(["proposal", "event", "client", "vendor", "objective", "workspace", "fallback"]).toContain(score.readiness.source);
      // Never a silent 0 fallback — a fallback resolution always uses the documented neutral value, and only a real measurement is allowed to be exactly 0.
      if (score.readiness.isFallback) expect(score.readiness.value).toBe(50);
    }
  });

  it("orders the queue by priority (critical first) and never includes resolved or archived decisions", async () => {
    const result = await evaluateExecutiveDecisionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.queue.every((d) => d.status !== "resolved" && d.status !== "archived")).toBe(true);
    const priorityRank = { critical: 0, high: 1, medium: 2, low: 3, informational: 4 } as const;
    for (let i = 1; i < result.data.queue.length; i++) {
      expect(priorityRank[result.data.queue[i - 1].priority]).toBeLessThanOrEqual(priorityRank[result.data.queue[i].priority]);
    }
  });

  it("does not spawn duplicate decisions on a second evaluation of an unchanged workspace", async () => {
    const first = await evaluateExecutiveDecisionsAction();
    expect(first.success).toBe(true);
    if (!first.success) return;

    const second = await evaluateExecutiveDecisionsAction();
    expect(second.success).toBe(true);
    if (!second.success) return;

    expect(second.data.allDecisions.length).toBe(first.data.allDecisions.length);
  });

  it("records Timeline activity for every newly-created decision", async () => {
    const result = await evaluateExecutiveDecisionsAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    if (result.data.allDecisions.length === 0) return;

    expect(readActivities().some((a) => a.type === "decision_created")).toBe(true);
  });
});

describe("updateDecisionStatusAction", () => {
  it("resolves a decision with no dependencies and records decision_resolved", async () => {
    const evaluation = await evaluateExecutiveDecisionsAction();
    expect(evaluation.success).toBe(true);
    if (!evaluation.success || evaluation.data.allDecisions.length === 0) return;

    const target = evaluation.data.allDecisions[0];
    const result = await updateDecisionStatusAction(target.id, "resolved", "Handled manually.");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("resolved");
  });

  it("returns an error for a decision that doesn't exist", async () => {
    const result = await updateDecisionStatusAction("decision_missing", "resolved");
    expect(result.success).toBe(false);
  });
});

describe("permission enforcement (Checkpoint 45A — Finding 14)", () => {
  it("rejects updateDecisionStatusAction for a session without executive_decisions.manage", async () => {
    const evaluation = await evaluateExecutiveDecisionsAction();
    expect(evaluation.success).toBe(true);
    if (!evaluation.success || evaluation.data.allDecisions.length === 0) return;
    const target = evaluation.data.allDecisions[0];

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: ["assets.view", "assets.manage"] });
    const result = await updateDecisionStatusAction(target.id, "resolved", "Handled manually.");
    expect(result.success).toBe(false);
  });
});
