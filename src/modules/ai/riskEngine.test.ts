import { describe, expect, it } from "vitest";
import { detectOperationalRisks, type RiskDetectionInput } from "@/modules/ai/riskEngine";

function baseInput(overrides: Partial<RiskDetectionInput> = {}): RiskDetectionInput {
  return {
    checklistOverdueCount: 0,
    scheduleDelayedCount: 0,
    assignedOwner: "Jamie",
    missingInformation: [],
    healthStatus: "ready",
    daysUntilEvent: 30,
    ...overrides,
  };
}

describe("detectOperationalRisks", () => {
  it("returns no risks when nothing is wrong", () => {
    expect(detectOperationalRisks(baseInput())).toEqual([]);
  });

  it("detects overdue checklist items, escalating severity at 3+", () => {
    const low = detectOperationalRisks(baseInput({ checklistOverdueCount: 1 }));
    const high = detectOperationalRisks(baseInput({ checklistOverdueCount: 3 }));
    expect(low.find((r) => r.kind === "overdue_checklist")?.severity).toBe("medium");
    expect(high.find((r) => r.kind === "overdue_checklist")?.severity).toBe("high");
  });

  it("detects delayed schedule items, escalating severity at 2+", () => {
    const one = detectOperationalRisks(baseInput({ scheduleDelayedCount: 1 }));
    const two = detectOperationalRisks(baseInput({ scheduleDelayedCount: 2 }));
    expect(one.find((r) => r.kind === "overdue_schedule")?.severity).toBe("medium");
    expect(two.find((r) => r.kind === "overdue_schedule")?.severity).toBe("high");
  });

  it("detects a missing owner", () => {
    const risks = detectOperationalRisks(baseInput({ assignedOwner: null }));
    expect(risks.some((r) => r.kind === "missing_owner")).toBe(true);
  });

  it("does not flag a missing owner when one is assigned", () => {
    const risks = detectOperationalRisks(baseInput({ assignedOwner: "Jamie" }));
    expect(risks.some((r) => r.kind === "missing_owner")).toBe(false);
  });

  it("detects incomplete information, escalating severity at 2+ gaps", () => {
    const one = detectOperationalRisks(baseInput({ missingInformation: ["Missing budget"] }));
    const two = detectOperationalRisks(baseInput({ missingInformation: ["Missing budget", "Missing location"] }));
    expect(one.find((r) => r.kind === "incomplete_information")?.severity).toBe("low");
    expect(two.find((r) => r.kind === "incomplete_information")?.severity).toBe("medium");
  });

  it("detects an approaching date when not yet ready, within the 7-day window", () => {
    const risks = detectOperationalRisks(baseInput({ healthStatus: "waiting", daysUntilEvent: 3 }));
    expect(risks.some((r) => r.kind === "approaching_date_not_ready")).toBe(true);
  });

  it("does not flag an approaching date once the Event is ready", () => {
    const risks = detectOperationalRisks(baseInput({ healthStatus: "ready", daysUntilEvent: 3 }));
    expect(risks.some((r) => r.kind === "approaching_date_not_ready")).toBe(false);
  });

  it("does not flag an approaching date outside the 7-day window", () => {
    const risks = detectOperationalRisks(baseInput({ healthStatus: "waiting", daysUntilEvent: 8 }));
    expect(risks.some((r) => r.kind === "approaching_date_not_ready")).toBe(false);
  });

  it("does not flag an approaching date for a past event", () => {
    const risks = detectOperationalRisks(baseInput({ healthStatus: "waiting", daysUntilEvent: -1 }));
    expect(risks.some((r) => r.kind === "approaching_date_not_ready")).toBe(false);
  });

  it("does not flag an approaching date when there is no event date at all", () => {
    const risks = detectOperationalRisks(baseInput({ healthStatus: "waiting", daysUntilEvent: null }));
    expect(risks.some((r) => r.kind === "approaching_date_not_ready")).toBe(false);
  });

  it("orders risks by severity, highest first", () => {
    const risks = detectOperationalRisks(
      baseInput({ assignedOwner: null, checklistOverdueCount: 5, missingInformation: ["x"] }),
    );
    const severities = risks.map((r) => r.severity);
    const weight = { high: 2, medium: 1, low: 0 } as const;
    for (let i = 1; i < severities.length; i++) {
      expect(weight[severities[i - 1]]).toBeGreaterThanOrEqual(weight[severities[i]]);
    }
  });

  it("is deterministic — identical input always produces identical output", () => {
    const input = baseInput({ checklistOverdueCount: 2, assignedOwner: null });
    expect(detectOperationalRisks(input)).toEqual(detectOperationalRisks(input));
  });
});
