import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/ai/skills/resolver", () => ({ executeSkill: vi.fn() }));

import { makeRunSkillAction, runSkillFallbackActionId } from "@/modules/automation/actions/runSkillActionFactory";
import { executeSkill } from "@/core/ai/skills/resolver";
import type { AutomationActionParams } from "@/types/automation";

function makeParams(overrides: Partial<AutomationActionParams> = {}): AutomationActionParams {
  return {
    workspaceId: "ws_1",
    workspaceName: "Amoré Bloom",
    userId: "member_1",
    userName: "Owner",
    role: "owner",
    permissions: ["clients.view"],
    facts: { clientId: "client_1", score: 42, flagged: null },
    automationId: "workflow-wf_1-trigger-client.created-path-0",
    ...overrides,
  };
}

const spec = {
  id: "run-skill.browse-ai-memory",
  name: "Browse AI Memory",
  description: "test",
  skillId: "browse-ai-memory",
  category: "operations" as const,
  requiredPermissions: [],
  minimumRole: null,
};

describe("makeRunSkillAction", () => {
  it("runSkillFallbackActionId is a stable, skill-id-derived id", () => {
    expect(runSkillFallbackActionId("browse-ai-memory")).toBe("run-skill.browse-ai-memory");
  });

  it("calls executeSkill with the closed-over skillId and the trigger's own facts converted to refs", async () => {
    vi.mocked(executeSkill).mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} as never });

    const action = makeRunSkillAction(spec);
    const result = await action.execute(makeParams());

    expect(result.success).toBe(true);
    expect(executeSkill).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "browse-ai-memory",
        workspaceId: "ws_1",
        userId: "member_1",
        permissions: ["clients.view"],
        role: "owner",
        refs: { clientId: "client_1", score: "42", flagged: undefined },
      }),
    );
  });

  it("defaults userId to \"system\" for a system-originated trigger with no acting member", async () => {
    vi.mocked(executeSkill).mockResolvedValue({ success: true, data: {}, context: {}, metadata: {} as never });

    const action = makeRunSkillAction(spec);
    await action.execute(makeParams({ userId: null }));

    expect(executeSkill).toHaveBeenCalledWith(expect.objectContaining({ userId: "system" }));
  });

  it("surfaces executeSkill's own error message on failure", async () => {
    vi.mocked(executeSkill).mockResolvedValue({ success: false, error: { category: "permission_denied", message: "You don't have permission to run this Skill." } });

    const action = makeRunSkillAction(spec);
    const result = await action.execute(makeParams());

    expect(result.success).toBe(false);
    expect(result.message).toBe("You don't have permission to run this Skill.");
  });
});
