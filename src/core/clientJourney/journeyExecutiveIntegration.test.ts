import { describe, it, expect } from "vitest";
import { journeyBlockersToRecommendations, journeyRisksToRecommendations } from "./journeyExecutiveIntegration";
import type { JourneyBlocker, JourneyRisk } from "@/types/clientJourney";

function blocker(severity: JourneyBlocker["severity"]): JourneyBlocker {
  return { id: "b1", type: "deposit_unpaid", stage: "deposit_paid", severity, sourceModule: "finance", sourceRecordId: null, description: "Deposit unpaid", suggestedNextAction: "", detectedAt: "2026-01-01T00:00:00.000Z" };
}

function risk(severity: JourneyRisk["severity"]): JourneyRisk {
  return { id: "r1", type: "lead_going_cold", severity, stage: "contacted", description: "Lead going cold", sourceRecordId: null, detectedAt: "2026-01-01T00:00:00.000Z" };
}

describe("journeyBlockersToRecommendations", () => {
  it("translates a critical blocker to critical severity, never inventing a new severity scale", () => {
    const recs = journeyBlockersToRecommendations([blocker("critical")], "client", "client_1");
    expect(recs[0].severity).toBe("critical");
  });

  it("translates high/medium blockers down to warning (the closest RecommendationSeverity)", () => {
    const recs = journeyBlockersToRecommendations([blocker("high")], "client", "client_1");
    expect(recs[0].severity).toBe("warning");
  });

  it("stamps the exact subject as the recommendation's node reference", () => {
    const recs = journeyBlockersToRecommendations([blocker("critical")], "lead", "lead_42");
    expect(recs[0].node).toEqual({ nodeType: "lead", nodeId: "lead_42" });
  });

  it("prefixes every ruleId with client_journey.blocker so it's traceable back to this engine", () => {
    const recs = journeyBlockersToRecommendations([blocker("critical")], "client", "client_1");
    expect(recs[0].ruleId).toBe("client_journey.blocker.deposit_unpaid");
  });
});

describe("journeyRisksToRecommendations", () => {
  it("translates risks with the same severity map and a distinct ruleId prefix", () => {
    const recs = journeyRisksToRecommendations([risk("low")], "client", "client_1");
    expect(recs[0].severity).toBe("info");
    expect(recs[0].ruleId).toBe("client_journey.risk.lead_going_cold");
  });
});
