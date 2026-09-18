import { describe, expect, it } from "vitest";
import { triggerNodes, leadCreatedTrigger, leadStatusChangedTrigger, leadConvertedTrigger, leadAssignedTrigger } from "@/modules/workflow/nodes/triggerNodes";
import { AUTOMATION_CONDITION_FIELDS } from "@/types/automation";
import { evaluateConditions } from "@/core/automation/conditions";
import { resolveNodeIcon } from "@/modules/workflow/canvas/nodeIcons";

describe("SOCIAL-16D — Lead lifecycle trigger nodes", () => {
  it("lead.created is registered in the trigger palette and compiles to the exact AutomationTriggerType", () => {
    expect(triggerNodes).toContain(leadCreatedTrigger);
    expect(leadCreatedTrigger.compileTarget).toBe("lead.created");
    expect(leadCreatedTrigger.kind).toBe("trigger");
  });

  it("lead.status_changed is registered in the trigger palette and compiles to the exact AutomationTriggerType", () => {
    expect(triggerNodes).toContain(leadStatusChangedTrigger);
    expect(leadStatusChangedTrigger.compileTarget).toBe("lead.status_changed");
    expect(leadStatusChangedTrigger.kind).toBe("trigger");
  });

  it("lead.converted is registered in the trigger palette and compiles to the exact AutomationTriggerType", () => {
    expect(triggerNodes).toContain(leadConvertedTrigger);
    expect(leadConvertedTrigger.compileTarget).toBe("lead.converted");
    expect(leadConvertedTrigger.kind).toBe("trigger");
  });

  it("SOCIAL-18C — lead.assigned is registered in the trigger palette and compiles to the exact AutomationTriggerType", () => {
    expect(triggerNodes).toContain(leadAssignedTrigger);
    expect(leadAssignedTrigger.id).toBe("trigger.lead-assigned");
    expect(leadAssignedTrigger.name).toBe("Lead Assigned");
    expect(leadAssignedTrigger.icon).toBe("UserCheck");
    expect(leadAssignedTrigger.compileTarget).toBe("lead.assigned");
    expect(leadAssignedTrigger.kind).toBe("trigger");
  });

  it("every new trigger node resolves to a real, mapped icon — never the HelpCircle fallback used for an unmapped name", () => {
    const fallback = resolveNodeIcon("__unmapped_name_used_only_for_this_test__");
    for (const node of [leadCreatedTrigger, leadStatusChangedTrigger, leadConvertedTrigger, leadAssignedTrigger]) {
      expect(resolveNodeIcon(node.icon)).not.toBe(fallback);
    }
  });

  it("previousStatus and newStatus are selectable Condition fields", () => {
    expect(AUTOMATION_CONDITION_FIELDS).toContain("previousStatus");
    expect(AUTOMATION_CONDITION_FIELDS).toContain("newStatus");
  });

  it("SOCIAL-18C — previousAssignee and newAssignee are selectable Condition fields", () => {
    expect(AUTOMATION_CONDITION_FIELDS).toContain("previousAssignee");
    expect(AUTOMATION_CONDITION_FIELDS).toContain("newAssignee");
  });

  describe("condition evaluation — no evaluator change needed for LeadStatus facts", () => {
    function context(newStatus: string, previousStatus: string) {
      return {
        trigger: { type: "lead.status_changed" as const, workspaceId: "ws_1", occurredAt: "2026-09-17T00:00:00.000Z", actorMemberId: null, facts: { leadId: "lead_1", previousStatus, newStatus } },
        role: null,
      };
    }

    it("eq matches when newStatus equals the expected value", async () => {
      const passed = await evaluateConditions([{ field: "newStatus", operator: "eq", value: "qualified" }], context("qualified", "contacted"));
      expect(passed).toBe(true);
    });

    it("eq fails to match when newStatus differs from the expected value", async () => {
      const passed = await evaluateConditions([{ field: "newStatus", operator: "eq", value: "qualified" }], context("lost", "contacted"));
      expect(passed).toBe(false);
    });

    it("neq matches when previousStatus differs from the excluded value", async () => {
      const passed = await evaluateConditions([{ field: "previousStatus", operator: "neq", value: "new" }], context("qualified", "contacted"));
      expect(passed).toBe(true);
    });

    it("neq fails to match when previousStatus equals the excluded value", async () => {
      const passed = await evaluateConditions([{ field: "previousStatus", operator: "neq", value: "new" }], context("contacted", "new"));
      expect(passed).toBe(false);
    });
  });

  describe("SOCIAL-18C — condition evaluation for lead.assigned facts (non-null values only, per scope)", () => {
    function assignedContext(newAssignee: string | null, previousAssignee: string | null) {
      return {
        trigger: { type: "lead.assigned" as const, workspaceId: "ws_1", occurredAt: "2026-09-17T00:00:00.000Z", actorMemberId: null, facts: { leadId: "lead_1", previousAssignee, newAssignee } },
        role: null,
      };
    }

    it("eq matches when newAssignee equals the expected non-null value", async () => {
      const passed = await evaluateConditions([{ field: "newAssignee", operator: "eq", value: "Aline Ferreira" }], assignedContext("Aline Ferreira", null));
      expect(passed).toBe(true);
    });

    it("eq fails to match when newAssignee differs from the expected value", async () => {
      const passed = await evaluateConditions([{ field: "newAssignee", operator: "eq", value: "Aline Ferreira" }], assignedContext("Jamie Rivera", "Aline Ferreira"));
      expect(passed).toBe(false);
    });

    it("neq matches when previousAssignee differs from the excluded non-null value", async () => {
      const passed = await evaluateConditions([{ field: "previousAssignee", operator: "neq", value: "Jamie Rivera" }], assignedContext("Aline Ferreira", "Someone Else"));
      expect(passed).toBe(true);
    });

    it("neq fails to match when previousAssignee equals the excluded value", async () => {
      const passed = await evaluateConditions([{ field: "previousAssignee", operator: "neq", value: "Aline Ferreira" }], assignedContext("Jamie Rivera", "Aline Ferreira"));
      expect(passed).toBe(false);
    });
  });
});
