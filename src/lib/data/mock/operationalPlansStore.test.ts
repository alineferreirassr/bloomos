import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockOperationalPlansRepository, resetOperationalPlansStore, type CreateOperationalPlanInput } from "@/lib/data/mock/operationalPlansStore";

function baseInput(overrides: Partial<CreateOperationalPlanInput> = {}): CreateOperationalPlanInput {
  return { name: "Wedding Proposal Plan", template_id: null, context_type: "event", context: { nodeType: "event", nodeId: "event_1" }, phases: [], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [], ...overrides };
}

beforeEach(() => resetOperationalPlansStore());
afterEach(() => resetOperationalPlansStore());

describe("mockOperationalPlansRepository", () => {
  it("creates a plan as draft, version 1", async () => {
    const result = await mockOperationalPlansRepository.createPlan("ws_1", "member_1", baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
      expect(result.data.version).toBe(1);
    }
  });

  it("rejects a blank name", async () => {
    const result = await mockOperationalPlansRepository.createPlan("ws_1", "member_1", baseInput({ name: "  " }));
    expect(result.success).toBe(false);
  });

  it("listPlansForWorkspace scopes to the workspace and excludes archived by default", async () => {
    const created = await mockOperationalPlansRepository.createPlan("ws_1", "member_1", baseInput());
    await mockOperationalPlansRepository.createPlan("ws_2", "member_1", baseInput());
    if (!created.success) return;
    await mockOperationalPlansRepository.setPlanStatus(created.data.id, "ws_1", "archived", null);

    const activeOnly = await mockOperationalPlansRepository.listPlansForWorkspace("ws_1");
    expect(activeOnly).toHaveLength(0);
    const withArchived = await mockOperationalPlansRepository.listPlansForWorkspace("ws_1", true);
    expect(withArchived).toHaveLength(1);
    const ws2 = await mockOperationalPlansRepository.listPlansForWorkspace("ws_2");
    expect(ws2).toHaveLength(1);
  });

  it("updatePlan increments version and rejects a blank name", async () => {
    const created = await mockOperationalPlansRepository.createPlan("ws_1", "member_1", baseInput());
    if (!created.success) return;

    const updated = await mockOperationalPlansRepository.updatePlan(created.data.id, "ws_1", { name: "Updated Plan" });
    expect(updated.success).toBe(true);
    if (updated.success) {
      expect(updated.data.name).toBe("Updated Plan");
      expect(updated.data.version).toBe(2);
    }

    const rejected = await mockOperationalPlansRepository.updatePlan(created.data.id, "ws_1", { name: "  " });
    expect(rejected.success).toBe(false);
  });

  it("setPlanStatus records approved_at/approved_by on approval, and clears archived_at on reactivation", async () => {
    const created = await mockOperationalPlansRepository.createPlan("ws_1", "member_1", baseInput());
    if (!created.success) return;

    const approved = await mockOperationalPlansRepository.setPlanStatus(created.data.id, "ws_1", "approved", "member_2");
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.approved_by).toBe("member_2");
      expect(approved.data.approved_at).not.toBeNull();
    }

    const archived = await mockOperationalPlansRepository.setPlanStatus(created.data.id, "ws_1", "archived", null);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const reactivated = await mockOperationalPlansRepository.setPlanStatus(created.data.id, "ws_1", "active", null);
    expect(reactivated.success).toBe(true);
    if (reactivated.success) {
      expect(reactivated.data.archived_at).toBeNull();
      expect(reactivated.data.approved_by).toBe("member_2");
    }
  });

  it("getPlanById returns null for a plan that doesn't exist", async () => {
    expect(await mockOperationalPlansRepository.getPlanById("plan_missing")).toBeNull();
  });
});
