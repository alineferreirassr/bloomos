import type { OperationsRisk } from "@/core/operations/types";

/**
 * RiskEngine (v2 Checkpoint 21, Step 12) — a small, explicitly extensible
 * list of pure detector functions, mirroring `eventAssistant.ts`/the
 * Checkpoint 2 Event Operations Brief's own `riskEngine.ts` precedent: each
 * detector reuses a signal the caller already computed (never a new fact),
 * returns zero or one `OperationsRisk`, and the exported list can grow by
 * appending a new entry — never by editing the ones already here.
 */

export interface RiskDetectionInput {
  hasUnassignedTeamRequirement: boolean;
  hasLateVendorAssignment: boolean;
  hasLowStockAssignedItem: boolean;
  outstandingBalanceMinor: number;
  hasOverdueInvoice: boolean;
  hasActiveContract: boolean;
  isOverBudget: boolean;
  hasLatePurchase: boolean;
  hasChecklistItems: boolean;
  daysUntilEvent: number | null;
}

type RiskDetector = (input: RiskDetectionInput) => OperationsRisk | null;

const detectMissingTeam: RiskDetector = (input) =>
  input.hasUnassignedTeamRequirement
    ? {
        kind: "missing_team",
        severity: "warning",
        message: "One or more team roles for this event are not yet assigned.",
        recommendation: "Assign a team member to every required role before the event date.",
      }
    : null;

const detectLateVendor: RiskDetector = (input) =>
  input.hasLateVendorAssignment
    ? {
        kind: "late_vendor",
        severity: "warning",
        message: "A vendor requirement is still unconfirmed close to the event date.",
        recommendation: "Confirm or reassign the pending vendor requirement.",
      }
    : null;

const detectLowInventory: RiskDetector = (input) =>
  input.hasLowStockAssignedItem
    ? {
        kind: "low_inventory",
        severity: "warning",
        message: "An item assigned to this event is low in stock workspace-wide.",
        recommendation: "Reserve stock now or arrange a purchase before it runs out.",
      }
    : null;

const detectPendingPayment: RiskDetector = (input) =>
  input.outstandingBalanceMinor > 0 || input.hasOverdueInvoice
    ? {
        kind: "pending_payment",
        severity: input.hasOverdueInvoice ? "critical" : "warning",
        message: input.hasOverdueInvoice
          ? "An invoice for this event is overdue."
          : "This event has an outstanding payment balance.",
        recommendation: "Send a payment reminder or follow up with the client directly.",
      }
    : null;

const detectMissingContract: RiskDetector = (input) =>
  !input.hasActiveContract
    ? {
        kind: "missing_contract",
        severity: "critical",
        message: "This event has no active contract on file.",
        recommendation: "Generate and send a contract before proceeding further.",
      }
    : null;

const detectBudgetOverrun: RiskDetector = (input) =>
  input.isOverBudget
    ? {
        kind: "budget_overrun",
        severity: "critical",
        message: "Actual cost has exceeded the estimated budget for this event.",
        recommendation: "Review recent expenses and purchases against the original estimate.",
      }
    : null;

const detectLatePurchase: RiskDetector = (input) =>
  input.hasLatePurchase
    ? {
        kind: "late_purchase",
        severity: "warning",
        message: "A purchase order for this event is overdue for delivery.",
        recommendation: "Follow up with the vendor on the delayed order.",
      }
    : null;

const detectMissingChecklist: RiskDetector = (input) =>
  !input.hasChecklistItems
    ? {
        kind: "missing_checklist",
        severity: input.daysUntilEvent !== null && input.daysUntilEvent <= 14 ? "critical" : "warning",
        message: "This event has no checklist items yet.",
        recommendation: "Build a planning checklist so nothing is missed before the event.",
      }
    : null;

export const RISK_DETECTORS: RiskDetector[] = [
  detectMissingContract,
  detectPendingPayment,
  detectBudgetOverrun,
  detectMissingTeam,
  detectLateVendor,
  detectLowInventory,
  detectLatePurchase,
  detectMissingChecklist,
];

/** Runs every registered detector and returns only the risks that actually triggered, critical first. */
export function detectOperationsRisks(input: RiskDetectionInput): OperationsRisk[] {
  const risks = RISK_DETECTORS.map((detector) => detector(input)).filter((risk): risk is OperationsRisk => risk !== null);
  return risks.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
}
