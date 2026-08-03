import { describe, expect, it } from "vitest";
import { detectEscalations, type EscalationDetectionInput } from "@/core/communication/escalationEngine";

function emptyInput(): EscalationDetectionInput {
  return { unreadCriticalNotifications: [], overdueReminders: [], lateApprovals: [], missedDeadlines: [], pendingResponses: [], highRiskEvents: [] };
}

describe("detectEscalations", () => {
  it("returns nothing for a perfectly healthy workspace", () => {
    expect(detectEscalations(emptyInput())).toEqual([]);
  });

  it("escalates an unread critical notification only past the 4-hour threshold", () => {
    const input = emptyInput();
    input.unreadCriticalNotifications = [{ id: "n1", recipientMemberId: "member_1", ageHours: 2 }];
    expect(detectEscalations(input)).toEqual([]);

    input.unreadCriticalNotifications = [{ id: "n1", recipientMemberId: "member_1", ageHours: 5 }];
    const candidates = detectEscalations(input);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ kind: "unread_critical_notification", severity: "critical", relatedMemberId: "member_1" });
  });

  it("escalates an overdue reminder, critical once it's a full day overdue", () => {
    const input = emptyInput();
    input.overdueReminders = [{ id: "r1", assignedToMemberId: "member_2", overdueHours: 2 }];
    expect(detectEscalations(input)[0].severity).toBe("warning");

    input.overdueReminders = [{ id: "r1", assignedToMemberId: "member_2", overdueHours: 30 }];
    expect(detectEscalations(input)[0].severity).toBe("critical");
  });

  it("escalates a late Automation approval only past 24 hours, referencing the automation owner type", () => {
    const input = emptyInput();
    input.lateApprovals = [{ executionId: "exec_1", automationName: "Notify overdue invoice", ageHours: 10 }];
    expect(detectEscalations(input)).toEqual([]);

    input.lateApprovals = [{ executionId: "exec_1", automationName: "Notify overdue invoice", ageHours: 25 }];
    const candidates = detectEscalations(input);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ kind: "late_approval", severity: "critical", ownerType: "automation", ownerId: "exec_1" });
  });

  it("escalates a high-risk event only below the 45 health-score threshold", () => {
    const input = emptyInput();
    input.highRiskEvents = [{ eventId: "event_1", eventName: "Malibu Sunset", healthScore: 50 }];
    expect(detectEscalations(input)).toEqual([]);

    input.highRiskEvents = [{ eventId: "event_1", eventName: "Malibu Sunset", healthScore: 30 }];
    const candidates = detectEscalations(input);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ kind: "high_risk_event", severity: "critical", ownerType: "event", ownerId: "event_1" });
  });

  it("escalates a pending response only past the 48-hour threshold", () => {
    const input = emptyInput();
    input.pendingResponses = [{ threadId: "thread_1", memberId: "member_3", ageHours: 40 }];
    expect(detectEscalations(input)).toEqual([]);

    input.pendingResponses = [{ threadId: "thread_1", memberId: "member_3", ageHours: 50 }];
    expect(detectEscalations(input)).toHaveLength(1);
  });

  it("aggregates independently across every detector at once", () => {
    const input: EscalationDetectionInput = {
      unreadCriticalNotifications: [{ id: "n1", recipientMemberId: "member_1", ageHours: 10 }],
      overdueReminders: [{ id: "r1", assignedToMemberId: "member_2", overdueHours: 5 }],
      lateApprovals: [],
      missedDeadlines: [],
      pendingResponses: [],
      highRiskEvents: [],
    };
    expect(detectEscalations(input)).toHaveLength(2);
  });
});
