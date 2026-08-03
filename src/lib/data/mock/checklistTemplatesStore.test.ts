import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockChecklistTemplatesRepository, resetChecklistTemplatesStore, type CreateChecklistTemplateInput } from "@/lib/data/mock/checklistTemplatesStore";

function baseInput(overrides: Partial<CreateChecklistTemplateInput> = {}): CreateChecklistTemplateInput {
  return { name: "Vehicle Safety Checklist", kind: "vehicle", items: [{ label: "Check tire pressure" }, { label: "Check fuel level" }], ...overrides };
}

beforeEach(() => resetChecklistTemplatesStore());
afterEach(() => resetChecklistTemplatesStore());

describe("mockChecklistTemplatesRepository", () => {
  it("creates a template with generated item ids", async () => {
    const result = await mockChecklistTemplatesRepository.createTemplate("ws_1", "member_1", baseInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0].id).toBeTruthy();
      expect(result.data.items[0].label).toBe("Check tire pressure");
    }
  });

  it("rejects a blank name", async () => {
    const result = await mockChecklistTemplatesRepository.createTemplate("ws_1", "member_1", baseInput({ name: " " }));
    expect(result.success).toBe(false);
  });

  it("rejects a checklist with zero items", async () => {
    const result = await mockChecklistTemplatesRepository.createTemplate("ws_1", "member_1", baseInput({ items: [] }));
    expect(result.success).toBe(false);
  });

  it("setTemplateStatus archives and reactivates", async () => {
    const created = await mockChecklistTemplatesRepository.createTemplate("ws_1", "member_1", baseInput());
    if (!created.success) return;
    const archived = await mockChecklistTemplatesRepository.setTemplateStatus(created.data.id, "ws_1", "archived");
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();
    const reactivated = await mockChecklistTemplatesRepository.setTemplateStatus(created.data.id, "ws_1", "active");
    if (reactivated.success) expect(reactivated.data.archived_at).toBeNull();
  });

  it("listTemplatesForWorkspace scopes to the workspace", async () => {
    await mockChecklistTemplatesRepository.createTemplate("ws_1", "member_1", baseInput());
    await mockChecklistTemplatesRepository.createTemplate("ws_2", "member_1", baseInput());
    const list = await mockChecklistTemplatesRepository.listTemplatesForWorkspace("ws_1");
    expect(list).toHaveLength(1);
  });
});
