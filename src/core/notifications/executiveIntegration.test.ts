import { describe, expect, it } from "vitest";
import { notificationHealthToRecommendations, notificationHealthRecommendationSource } from "@/core/notifications/executiveIntegration";
import type { NotificationHealthReport } from "@/types/notificationHealth";

function makeReport(overrides: Partial<NotificationHealthReport> = {}): NotificationHealthReport {
  return {
    categories: [
      { category: "delivery_readiness", score: 25, issues: ["3 of 4 channels have no delivery provider registered: email, sms, push."], notApplicableReason: null },
      { category: "template_coverage", score: 100, issues: [], notApplicableReason: null },
      { category: "routing_health", score: null, issues: [], notApplicableReason: "No notifications recorded yet." },
      { category: "preference_health", score: 60, issues: ["3 of 5 member(s) have never customized their notification preferences (still on defaults)."], notApplicableReason: null },
      { category: "configuration_health", score: 0, issues: ["No workspace-level notification defaults have been explicitly configured yet — every value is still on its registered default."], notApplicableReason: null },
    ],
    overallScore: 41,
    findings: [],
    evaluatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("notificationHealthToRecommendations", () => {
  it("translates every category issue into an OperationalRecommendation scoped to the workspace node", () => {
    const recommendations = notificationHealthToRecommendations(makeReport(), "ws_1");
    expect(recommendations).toHaveLength(3);
    expect(recommendations.every((r) => r.node.nodeType === "workspace" && r.node.nodeId === "ws_1")).toBe(true);
  });

  it("assigns critical severity below 50, warning below 80, info otherwise", () => {
    const recommendations = notificationHealthToRecommendations(makeReport(), "ws_1");
    const deliveryReadiness = recommendations.find((r) => r.ruleId === "notification_health_delivery_readiness");
    expect(deliveryReadiness?.severity).toBe("critical");
    const preferenceHealth = recommendations.find((r) => r.ruleId === "notification_health_preference_health");
    expect(preferenceHealth?.severity).toBe("warning");
  });

  it("produces zero recommendations for a fully healthy report", () => {
    const healthy = makeReport({
      categories: [
        { category: "delivery_readiness", score: 100, issues: [], notApplicableReason: null },
        { category: "template_coverage", score: 100, issues: [], notApplicableReason: null },
        { category: "routing_health", score: 100, issues: [], notApplicableReason: null },
        { category: "preference_health", score: 100, issues: [], notApplicableReason: null },
        { category: "configuration_health", score: 100, issues: [], notApplicableReason: null },
      ],
      overallScore: 100,
    });
    expect(notificationHealthToRecommendations(healthy, "ws_1")).toEqual([]);
  });
});

describe("notificationHealthRecommendationSource", () => {
  it("wraps the recommendations under the notification_health_engine generator name", () => {
    const source = notificationHealthRecommendationSource(makeReport(), "ws_1");
    expect(source.generatedBy).toBe("notification_health_engine");
    expect(source.recommendations.length).toBeGreaterThan(0);
  });
});
