import { describe, expect, it } from "vitest";
import { triggerNodes, leadCreatedTrigger, leadStatusChangedTrigger, leadConvertedTrigger, leadAssignedTrigger, instagramCommentReceivedTrigger, instagramMessageReceivedTrigger } from "@/modules/workflow/nodes/triggerNodes";
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
    for (const node of [leadCreatedTrigger, leadStatusChangedTrigger, leadConvertedTrigger, leadAssignedTrigger, instagramCommentReceivedTrigger, instagramMessageReceivedTrigger]) {
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

  describe("SOCIAL-21C — Instagram ingestion trigger nodes", () => {
    it("instagram.comment_received is registered in the trigger palette with the exact approved metadata", () => {
      expect(triggerNodes).toContain(instagramCommentReceivedTrigger);
      expect(instagramCommentReceivedTrigger.id).toBe("trigger.instagram-comment-received");
      expect(instagramCommentReceivedTrigger.name).toBe("Instagram Comment Received");
      expect(instagramCommentReceivedTrigger.description).toBe("Fires when a new Instagram comment is received.");
      expect(instagramCommentReceivedTrigger.icon).toBe("MessageSquare");
      expect(instagramCommentReceivedTrigger.compileTarget).toBe("instagram.comment_received");
      expect(instagramCommentReceivedTrigger.kind).toBe("trigger");
      expect(instagramCommentReceivedTrigger.requiredPermissions).toEqual([]);
    });

    it("instagram.message_received is registered in the trigger palette with the exact approved metadata", () => {
      expect(triggerNodes).toContain(instagramMessageReceivedTrigger);
      expect(instagramMessageReceivedTrigger.id).toBe("trigger.instagram-message-received");
      expect(instagramMessageReceivedTrigger.name).toBe("Instagram DM Received");
      expect(instagramMessageReceivedTrigger.description).toBe("Fires when a new inbound Instagram DM is received.");
      expect(instagramMessageReceivedTrigger.icon).toBe("MessageSquare");
      expect(instagramMessageReceivedTrigger.compileTarget).toBe("instagram.message_received");
      expect(instagramMessageReceivedTrigger.kind).toBe("trigger");
      expect(instagramMessageReceivedTrigger.requiredPermissions).toEqual([]);
    });

    it("the four approved instagram.comment_received condition fields are selectable", () => {
      expect(AUTOMATION_CONDITION_FIELDS).toContain("commentId");
      expect(AUTOMATION_CONDITION_FIELDS).toContain("instagramAccountIdentityId");
      expect(AUTOMATION_CONDITION_FIELDS).toContain("externalAuthorId");
      expect(AUTOMATION_CONDITION_FIELDS).toContain("hasParent");
    });

    it("the three approved instagram.message_received condition fields are selectable", () => {
      expect(AUTOMATION_CONDITION_FIELDS).toContain("messageId");
      expect(AUTOMATION_CONDITION_FIELDS).toContain("conversationId");
      expect(AUTOMATION_CONDITION_FIELDS).toContain("instagramAccountIdentityId");
    });

    it("never exposes raw comment/DM content or usernames as selectable Condition fields", () => {
      expect(AUTOMATION_CONDITION_FIELDS).not.toContain("commentText");
      expect(AUTOMATION_CONDITION_FIELDS).not.toContain("externalAuthorUsername");
      expect(AUTOMATION_CONDITION_FIELDS).not.toContain("messageText");
      expect(AUTOMATION_CONDITION_FIELDS).not.toContain("externalParticipantUsername");
      // `direction` is excluded for a different, structural reason: this
      // trigger only ever dispatches for an inbound message, so the value
      // is always "inbound" — a constant carries no discriminating value
      // as a Condition field, not a privacy concern.
      expect(AUTOMATION_CONDITION_FIELDS).not.toContain("direction");
    });

    describe("condition evaluation — instagram.comment_received facts", () => {
      function commentContext(overrides: Partial<{ commentId: string; instagramAccountIdentityId: string; externalAuthorId: string; hasParent: boolean }> = {}) {
        return {
          trigger: {
            type: "instagram.comment_received" as const,
            workspaceId: "ws_1",
            occurredAt: "2026-09-18T00:00:00.000Z",
            actorMemberId: null,
            facts: { commentId: "comment_1", instagramAccountIdentityId: "identity_1", externalAuthorId: "external_author_1", hasParent: false, ...overrides },
          },
          role: null,
        };
      }

      it("eq matches on commentId", async () => {
        const passed = await evaluateConditions([{ field: "commentId", operator: "eq", value: "comment_1" }], commentContext());
        expect(passed).toBe(true);
      });

      it("eq matches on instagramAccountIdentityId", async () => {
        const passed = await evaluateConditions([{ field: "instagramAccountIdentityId", operator: "eq", value: "identity_1" }], commentContext());
        expect(passed).toBe(true);
      });

      it("eq matches on externalAuthorId", async () => {
        const passed = await evaluateConditions([{ field: "externalAuthorId", operator: "eq", value: "external_author_1" }], commentContext());
        expect(passed).toBe(true);
      });

      it("eq matches on hasParent", async () => {
        const passed = await evaluateConditions([{ field: "hasParent", operator: "eq", value: true }], commentContext({ hasParent: true }));
        expect(passed).toBe(true);
      });

      it("eq fails to match a differing value", async () => {
        const passed = await evaluateConditions([{ field: "commentId", operator: "eq", value: "comment_other" }], commentContext());
        expect(passed).toBe(false);
      });
    });

    describe("condition evaluation — instagram.message_received facts", () => {
      function messageContext(overrides: Partial<{ messageId: string; conversationId: string; instagramAccountIdentityId: string }> = {}) {
        return {
          trigger: {
            type: "instagram.message_received" as const,
            workspaceId: "ws_1",
            occurredAt: "2026-09-18T00:00:00.000Z",
            actorMemberId: null,
            facts: { messageId: "message_1", conversationId: "conversation_1", instagramAccountIdentityId: "identity_1", direction: "inbound", ...overrides },
          },
          role: null,
        };
      }

      it("eq matches on messageId", async () => {
        const passed = await evaluateConditions([{ field: "messageId", operator: "eq", value: "message_1" }], messageContext());
        expect(passed).toBe(true);
      });

      it("eq matches on conversationId", async () => {
        const passed = await evaluateConditions([{ field: "conversationId", operator: "eq", value: "conversation_1" }], messageContext());
        expect(passed).toBe(true);
      });

      it("eq matches on instagramAccountIdentityId", async () => {
        const passed = await evaluateConditions([{ field: "instagramAccountIdentityId", operator: "eq", value: "identity_1" }], messageContext());
        expect(passed).toBe(true);
      });

      it("eq fails to match a differing value", async () => {
        const passed = await evaluateConditions([{ field: "messageId", operator: "eq", value: "message_other" }], messageContext());
        expect(passed).toBe(false);
      });
    });
  });
});
