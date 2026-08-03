import { describe, it, expect } from "vitest";
import { computeJourneyContext } from "./journeyContextEngine";
import type { JourneyBlocker, NextBestAction } from "@/types/clientJourney";
import type { ActivityEntry } from "@/types/communication";

function blocker(): JourneyBlocker {
  return { id: "b1", type: "deposit_unpaid", stage: "deposit_paid", severity: "critical", sourceModule: "finance", sourceRecordId: null, description: "Deposit unpaid", suggestedNextAction: "", detectedAt: "2026-01-01T00:00:00.000Z" };
}

function action(): NextBestAction {
  return { id: "a1", type: "follow_up_on_deposit", label: "Follow up on deposit", reason: "", priority: "critical", sourceStage: "deposit_paid", requiredPermission: "client_journeys.manage", deepLink: null, relatedSubjectType: "client", relatedSubjectId: "client_1", relatedSourceRecordId: null };
}

function timelineEntry(title: string): ActivityEntry {
  return {
    id: "e1",
    workspaceId: "workspace_1",
    category: "crm",
    kind: "lead_created",
    title,
    description: null,
    actorLabel: "System",
    actorMemberId: null,
    occurredAt: "2026-01-01T00:00:00.000Z",
    ownerType: "client",
    ownerId: "client_1",
    relatedAutomationExecutionId: null,
    relatedWorkflowId: null,
    relatedDocumentId: null,
    relatedPaymentId: null,
    relatedReminderId: null,
    relatedNotificationId: null,
    deepLink: null,
    pinned: false,
  } as ActivityEntry;
}

describe("computeJourneyContext", () => {
  it("summarizes a clean journey with no blockers", () => {
    const context = computeJourneyContext({ currentStage: "welcome", progressPercentage: 60, blockers: [], nextBestActions: [], recentTimeline: [], relatedCommercialRecords: [], relatedOperationalRecords: [] });
    expect(context.journeySummary).toContain("Welcome");
    expect(context.journeySummary).toContain("no active blockers");
  });

  it("surfaces the blocker count in the summary when blockers exist", () => {
    const context = computeJourneyContext({ currentStage: "deposit_paid", progressPercentage: 40, blockers: [blocker()], nextBestActions: [action()], recentTimeline: [], relatedCommercialRecords: [], relatedOperationalRecords: [] });
    expect(context.journeySummary).toContain("1 active blocker");
    expect(context.blockers).toEqual(["Deposit unpaid"]);
    expect(context.nextActions).toEqual(["Follow up on deposit"]);
  });

  it("never invents facts — recentActivity is only ever a slice of the caller-supplied timeline", () => {
    const context = computeJourneyContext({
      currentStage: "qualified",
      progressPercentage: 10,
      blockers: [],
      nextBestActions: [],
      recentTimeline: [timelineEntry("Lead created"), timelineEntry("Status changed")],
      relatedCommercialRecords: [],
      relatedOperationalRecords: [],
    });
    expect(context.recentActivity).toEqual(["Lead created", "Status changed"]);
  });

  it("reports no recent activity when the timeline is empty", () => {
    const context = computeJourneyContext({ currentStage: "qualified", progressPercentage: 10, blockers: [], nextBestActions: [], recentTimeline: [], relatedCommercialRecords: [], relatedOperationalRecords: [] });
    expect(context.communicationSummary).toBe("No recent activity recorded.");
  });

  it("passes related commercial/operational records through unchanged", () => {
    const context = computeJourneyContext({
      currentStage: "qualified",
      progressPercentage: 10,
      blockers: [],
      nextBestActions: [],
      recentTimeline: [],
      relatedCommercialRecords: [{ type: "proposal", id: "proposal_1" }],
      relatedOperationalRecords: [{ type: "event", id: "event_1" }],
    });
    expect(context.relatedCommercialRecords).toEqual([{ type: "proposal", id: "proposal_1" }]);
    expect(context.relatedOperationalRecords).toEqual([{ type: "event", id: "event_1" }]);
  });
});
