import { describe, it, expect } from "vitest";
import { computeJourneyHealth } from "./journeyHealthEngine";
import type { JourneyBlocker } from "@/types/clientJourney";

function blocker(overrides: Partial<JourneyBlocker> = {}): JourneyBlocker {
  return {
    id: "b1",
    type: "deposit_unpaid",
    stage: "deposit_paid",
    severity: "critical",
    sourceModule: "finance",
    sourceRecordId: null,
    description: "",
    suggestedNextAction: "",
    detectedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeJourneyHealth", () => {
  it("reports 100 across every component with no blockers and no readiness score", () => {
    const health = computeJourneyHealth({ blockers: [], operationalReadinessScore: null });
    expect(health.overallJourneyHealth).toBe(100);
    expect(health.paymentHealth).toBe(100);
    expect(health.operationalReadiness).toBe(100);
  });

  it("penalizes only the mapped component for a given blocker type", () => {
    const health = computeJourneyHealth({ blockers: [blocker({ type: "deposit_unpaid", severity: "critical" })], operationalReadinessScore: null });
    expect(health.paymentHealth).toBe(70);
    expect(health.contractHealth).toBe(100);
    expect(health.leadHealth).toBe(100);
  });

  it("stacks penalties from multiple blockers mapped to the same component", () => {
    const health = computeJourneyHealth({
      blockers: [blocker({ type: "deposit_unpaid", severity: "critical" }), blocker({ type: "final_balance_unpaid", severity: "critical" })],
      operationalReadinessScore: null,
    });
    expect(health.paymentHealth).toBe(40);
  });

  it("floors a component at 0 rather than going negative", () => {
    const health = computeJourneyHealth({
      blockers: [
        blocker({ type: "deposit_unpaid", severity: "critical" }),
        blocker({ type: "final_balance_unpaid", severity: "critical" }),
        blocker({ type: "final_balance_unpaid", severity: "critical" }),
        blocker({ type: "final_balance_unpaid", severity: "critical" }),
      ],
      operationalReadinessScore: null,
    });
    expect(health.paymentHealth).toBe(0);
  });

  it("reuses a caller-supplied operational readiness score verbatim, never recalculating it", () => {
    const health = computeJourneyHealth({ blockers: [], operationalReadinessScore: 42 });
    expect(health.operationalReadiness).toBe(42);
  });

  it("overallJourneyHealth is the unweighted average of every component", () => {
    const health = computeJourneyHealth({ blockers: [blocker({ type: "contract_unsigned", severity: "high" })], operationalReadinessScore: 100 });
    const components = [health.leadHealth, health.proposalHealth, health.contractHealth, health.invoiceHealth, health.paymentHealth, health.communicationHealth, health.portalHealth, health.planningHealth, health.operationalReadiness, health.clientResponseHealth];
    const expected = Math.round(components.reduce((sum, v) => sum + v, 0) / components.length);
    expect(health.overallJourneyHealth).toBe(expected);
  });
});
