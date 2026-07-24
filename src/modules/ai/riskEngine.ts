import type { DetectedRisk } from "@/modules/ai/types";

/**
 * Everything `detectOperationalRisks` needs — already-computed signals,
 * never raw rows. Each field here is something another part of BloomOS
 * already computes (Health factors, checklist/schedule stats); this file
 * never re-derives a fact, only decides whether an existing fact rises to
 * the level of a "risk" worth flagging.
 */
export interface RiskDetectionInput {
  checklistOverdueCount: number;
  scheduleDelayedCount: number;
  assignedOwner: string | null;
  missingInformation: string[];
  healthStatus: "ready" | "waiting" | "blocked";
  daysUntilEvent: number | null;
}

type RiskDetector = (input: RiskDetectionInput) => DetectedRisk | null;

const APPROACHING_WINDOW_DAYS = 7;

/**
 * Every detector below reads only signals BloomOS already computes
 * elsewhere (checklist/schedule stats, the Health engine, `assigned_owner`)
 * — none of them re-derive a fact or introduce a new threshold that isn't
 * already established (the 7-day "approaching" window matches
 * `eventHealth.ts`'s own `APPROACHING_WINDOW_DAYS`).
 *
 * Extension point: Inventory/Purchases/Finance risk detectors belong here
 * once Events gains a real, queryable relationship to those modules (none
 * exists today — confirmed during discovery, see the architecture report).
 * Append a new detector function to `RISK_DETECTORS` below; nothing else
 * in this file, `contextBuilder.ts`, or the prompt/schema needs to change,
 * since every detector already produces the same `DetectedRisk` shape.
 */
const detectOverdueChecklist: RiskDetector = (input) => {
  if (input.checklistOverdueCount === 0) return null;
  return {
    kind: "overdue_checklist",
    label: "Overdue checklist items",
    severity: input.checklistOverdueCount >= 3 ? "high" : "medium",
    evidence: `${input.checklistOverdueCount} checklist item(s) are past their due date.`,
  };
};

const detectOverdueSchedule: RiskDetector = (input) => {
  if (input.scheduleDelayedCount === 0) return null;
  return {
    kind: "overdue_schedule",
    label: "Delayed schedule items",
    severity: input.scheduleDelayedCount >= 2 ? "high" : "medium",
    evidence: `${input.scheduleDelayedCount} schedule item(s) are marked delayed.`,
  };
};

const detectMissingOwner: RiskDetector = (input) => {
  if (input.assignedOwner !== null) return null;
  return {
    kind: "missing_owner",
    label: "No assigned owner",
    severity: "low",
    evidence: "This Event has no assigned owner on file.",
  };
};

const detectIncompleteInformation: RiskDetector = (input) => {
  if (input.missingInformation.length === 0) return null;
  return {
    kind: "incomplete_information",
    label: "Incomplete event information",
    severity: input.missingInformation.length >= 2 ? "medium" : "low",
    evidence: `Missing: ${input.missingInformation.join(", ")}.`,
  };
};

const detectApproachingDateRisk: RiskDetector = (input) => {
  if (input.healthStatus === "ready") return null;
  if (input.daysUntilEvent === null) return null;
  if (input.daysUntilEvent < 0 || input.daysUntilEvent > APPROACHING_WINDOW_DAYS) return null;
  return {
    kind: "approaching_date_not_ready",
    label: "Event approaching without full readiness",
    severity: "high",
    evidence: `Event is ${input.daysUntilEvent} day(s) away and Health status is "${input.healthStatus}".`,
  };
};

const RISK_DETECTORS: RiskDetector[] = [
  detectOverdueChecklist,
  detectOverdueSchedule,
  detectMissingOwner,
  detectIncompleteInformation,
  detectApproachingDateRisk,
];

const SEVERITY_WEIGHT: Record<DetectedRisk["severity"], number> = { high: 2, medium: 1, low: 0 };

/** Pure and deterministic — same inputs always produce the same risk list, in severity order (highest first). */
export function detectOperationalRisks(input: RiskDetectionInput): DetectedRisk[] {
  return RISK_DETECTORS.map((detect) => detect(input))
    .filter((risk): risk is DetectedRisk => risk !== null)
    .sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]);
}
