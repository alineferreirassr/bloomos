import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { createObjectiveAction, listObjectivesAction, evaluateObjectivesAction, updateObjectiveStatusAction } from "@/modules/objectives/objectivesActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetObjectivesStore } from "@/lib/data/mock/objectivesStore";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { resetBusinessHealthSnapshotsStore } from "@/lib/data/mock/businessHealthSnapshotsStore";
import type { CreateObjectiveInput } from "@/core/objectives";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["assets.view", "assets.manage", "objectives.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetObjectivesStore();
  resetKnowledgeGraphStore();
  resetMediaAssetsStore();
  resetTimelineStore();
  resetBusinessHealthSnapshotsStore();
}

const noRequirementsInput: CreateObjectiveInput = {
  scope: "event",
  node: { nodeType: "event", nodeId: "event_1" },
  title: "Event is fully ready",
  description: null,
  requirements: [],
  dependencies: [],
  due_date: null,
};

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  resetAll();
});

describe("createObjectiveAction", () => {
  it("creates an objective and records an objective_created Timeline event", async () => {
    const result = await createObjectiveAction(noRequirementsInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("not_started");
    expect(readActivities().some((a) => a.type === "objective_created" && a.owner_id === "event_1")).toBe(true);
  });

  it("records the Timeline event against the workspace when the objective has no anchored node", async () => {
    await createObjectiveAction({ ...noRequirementsInput, scope: "department", node: null, title: "Marketing readiness" });
    expect(readActivities().some((a) => a.type === "objective_created" && a.owner_type === "workspace" && a.owner_id === "ws_1")).toBe(true);
  });

  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await createObjectiveAction(noRequirementsInput);
    expect(result.success).toBe(false);
  });
});

describe("listObjectivesAction", () => {
  it("lists objectives created for the workspace", async () => {
    await createObjectiveAction(noRequirementsInput);
    const result = await listObjectivesAction();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(1);
  });
});

describe("evaluateObjectivesAction", () => {
  it("evaluates a no-requirement objective at 100% completion and includes it in the scorecard", async () => {
    await createObjectiveAction(noRequirementsInput);
    const result = await evaluateObjectivesAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.evaluations).toHaveLength(1);
    expect(result.data.evaluations[0].progress.completionPercent).toBe(100);
    expect(result.data.scorecard.businessReadiness).toBeGreaterThanOrEqual(0);
  });

  it("evaluates a required_approvals requirement against the seeded workspace without crashing", async () => {
    await createObjectiveAction({
      ...noRequirementsInput,
      title: "Event has an approved hero image",
      requirements: [{ id: "r1", type: "required_assets", description: "Needs a Hero Image", relationshipType: "used_by", direction: "inbound", counterpartNodeType: "media_asset", requiredRole: "hero_image", minCount: 1 }],
    });
    const result = await evaluateObjectivesAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.evaluations[0].progress.completionPercent).toBe(0);
    expect(result.data.evaluations[0].health.state).not.toBe("blocked");
  });

  it("does not crash on a second evaluation", async () => {
    await createObjectiveAction(noRequirementsInput);
    const first = await evaluateObjectivesAction();
    const second = await evaluateObjectivesAction();
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
  });
});

describe("updateObjectiveStatusAction", () => {
  it("blocks completing an objective with an unmet dependency", async () => {
    const created = await createObjectiveAction({
      ...noRequirementsInput,
      dependencies: [{ id: "d1", kind: "approval", description: "Needs sign-off", targetObjectiveId: null, targetNode: null, businessRuleId: null, approvalKey: "never_true_this_checkpoint" }],
    });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await updateObjectiveStatusAction(created.data.id, "completed");
    expect(result.success).toBe(false);
  });

  it("allows completing an objective with no requirements or dependencies, and records objective_completed", async () => {
    const created = await createObjectiveAction(noRequirementsInput);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const result = await updateObjectiveStatusAction(created.data.id, "completed");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("completed");
    expect(readActivities().some((a) => a.type === "objective_completed")).toBe(true);
  });

  it("returns an error for an objective that doesn't exist", async () => {
    const result = await updateObjectiveStatusAction("objective_missing", "in_progress");
    expect(result.success).toBe(false);
  });
});

describe("permission enforcement (Checkpoint 45A — Finding 14)", () => {
  it("rejects createObjectiveAction for a session without objectives.manage", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: ["assets.view", "assets.manage"] });
    const result = await createObjectiveAction(noRequirementsInput);
    expect(result.success).toBe(false);
  });

  it("rejects updateObjectiveStatusAction for a session without objectives.manage", async () => {
    const created = await createObjectiveAction(noRequirementsInput);
    expect(created.success).toBe(true);
    if (!created.success) return;

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...session, permissions: ["assets.view", "assets.manage"] });
    const result = await updateObjectiveStatusAction(created.data.id, "completed");
    expect(result.success).toBe(false);
  });
});
