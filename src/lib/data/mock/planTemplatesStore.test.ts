import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockPlanTemplatesRepository, resetPlanTemplatesStore, type CreatePlanTemplateInput } from "@/lib/data/mock/planTemplatesStore";

function baseInput(overrides: Partial<CreatePlanTemplateInput> = {}): CreatePlanTemplateInput {
  return { name: "Wedding Proposal", category: "wedding_proposal", description: null, phases: [], milestones: [], deliverables: [], evidence_requirements: [], checklists: [], approvals: [], ...overrides };
}

beforeEach(() => resetPlanTemplatesStore());
afterEach(() => resetPlanTemplatesStore());

describe("mockPlanTemplatesRepository", () => {
  it("creates a template as active, version 1", async () => {
    const result = await mockPlanTemplatesRepository.createTemplate("ws_1", "member_1", baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
      expect(result.data.version).toBe(1);
    }
  });

  it("rejects a blank name", async () => {
    const result = await mockPlanTemplatesRepository.createTemplate("ws_1", "member_1", baseInput({ name: " " }));
    expect(result.success).toBe(false);
  });

  it("updateTemplate increments version — Step 21's 'Version Templates'", async () => {
    const created = await mockPlanTemplatesRepository.createTemplate("ws_1", "member_1", baseInput());
    if (!created.success) return;
    const updated = await mockPlanTemplatesRepository.updateTemplate(created.data.id, "ws_1", { description: "Updated" });
    expect(updated.success).toBe(true);
    if (updated.success) expect(updated.data.version).toBe(2);
  });

  it("setTemplateStatus archives and reactivates, clearing archived_at on reactivation", async () => {
    const created = await mockPlanTemplatesRepository.createTemplate("ws_1", "member_1", baseInput());
    if (!created.success) return;

    const archived = await mockPlanTemplatesRepository.setTemplateStatus(created.data.id, "ws_1", "archived");
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();

    const reactivated = await mockPlanTemplatesRepository.setTemplateStatus(created.data.id, "ws_1", "active");
    expect(reactivated.success).toBe(true);
    if (reactivated.success) expect(reactivated.data.archived_at).toBeNull();

    const listActiveOnly = await mockPlanTemplatesRepository.listTemplatesForWorkspace("ws_1");
    expect(listActiveOnly).toHaveLength(1);
  });

  it("duplicateTemplate appends '(Copy)' and resets version/status", async () => {
    const created = await mockPlanTemplatesRepository.createTemplate("ws_1", "member_1", baseInput());
    if (!created.success) return;
    await mockPlanTemplatesRepository.updateTemplate(created.data.id, "ws_1", { description: "v2" });
    await mockPlanTemplatesRepository.setTemplateStatus(created.data.id, "ws_1", "archived");

    const duplicated = await mockPlanTemplatesRepository.duplicateTemplate(created.data.id, "ws_1", "member_2");
    expect(duplicated.success).toBe(true);
    if (duplicated.success) {
      expect(duplicated.data.name).toBe("Wedding Proposal (Copy)");
      expect(duplicated.data.version).toBe(1);
      expect(duplicated.data.status).toBe("active");
      expect(duplicated.data.created_by).toBe("member_2");
    }
  });
});
