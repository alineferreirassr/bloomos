import { getEventHealthDetails, type EventHealthContext, type EventHealthInput } from "@/core/workflows/eventHealth";
import { OPERATIONS_HEALTH_BANDS, type OperationsHealthBand, type OperationsHealthFactor } from "@/core/operations/types";

/**
 * HealthScoreEngine (v2 Checkpoint 21, Step 11) — extends, never forks, the
 * existing eventHealth.ts (Checkpoint 19's Ready/Waiting/Blocked score).
 * That function stays the single source of the base 8 checklist/schedule/
 * contract/deposit/priority/date factors; this engine adds the operational
 * signals eventHealth.ts was never given (payments, inventory, vendors,
 * team, purchases, timeline, documents, budget) as additional deductions on
 * top of the same 0-100 scale, then classifies the combined score into the
 * four bands this checkpoint's spec requires (Excellent/Good/Attention/
 * Critical) instead of eventHealth.ts's own Ready/Waiting/Blocked — a
 * different audience (staff-wide operational triage vs. one Kanban badge),
 * not a replacement.
 */

const OPERATIONS_DEDUCTIONS = {
  outstandingPayment: 12,
  overdueInvoice: 18,
  lowStockAssignedItem: 10,
  unfulfilledShoppingItem: 8,
  unassignedVendorRequirement: 10,
  unassignedTeamRequirement: 12,
  latePurchase: 10,
  budgetOverrun: 15,
  noRecentActivity: 6,
  missingDocuments: 8,
} as const;

export interface OperationsHealthContext {
  event: EventHealthInput;
  eventHealthContext: EventHealthContext;
  outstandingBalanceMinor: number;
  hasOverdueInvoice: boolean;
  lowStockAssignedItemCount: number;
  unfulfilledShoppingItemCount: number;
  unassignedVendorRequirementCount: number;
  unassignedTeamRequirementCount: number;
  latePurchaseCount: number;
  isOverBudget: boolean;
  daysSinceLastActivity: number | null;
  documentCount: number;
}

export interface OperationsHealthDetails {
  score: number;
  band: OperationsHealthBand;
  factors: OperationsHealthFactor[];
}

function getOperationsFactors(context: OperationsHealthContext): OperationsHealthFactor[] {
  const factors: OperationsHealthFactor[] = [];

  if (context.outstandingBalanceMinor > 0) {
    factors.push({ label: "Outstanding payment balance", deduction: OPERATIONS_DEDUCTIONS.outstandingPayment, domain: "financial" });
  }
  if (context.hasOverdueInvoice) {
    factors.push({ label: "Overdue invoice", deduction: OPERATIONS_DEDUCTIONS.overdueInvoice, domain: "financial" });
  }
  if (context.lowStockAssignedItemCount > 0) {
    factors.push({ label: "Assigned inventory is low in stock", deduction: OPERATIONS_DEDUCTIONS.lowStockAssignedItem, domain: "inventory" });
  }
  if (context.unfulfilledShoppingItemCount > 0) {
    factors.push({ label: "Items still need sourcing", deduction: OPERATIONS_DEDUCTIONS.unfulfilledShoppingItem, domain: "inventory" });
  }
  if (context.unassignedVendorRequirementCount > 0) {
    factors.push({ label: "Vendor requirement not yet assigned", deduction: OPERATIONS_DEDUCTIONS.unassignedVendorRequirement, domain: "vendors" });
  }
  if (context.unassignedTeamRequirementCount > 0) {
    factors.push({ label: "Team role not yet assigned", deduction: OPERATIONS_DEDUCTIONS.unassignedTeamRequirement, domain: "team" });
  }
  if (context.latePurchaseCount > 0) {
    factors.push({ label: "Purchase order overdue for delivery", deduction: OPERATIONS_DEDUCTIONS.latePurchase, domain: "purchases" });
  }
  if (context.isOverBudget) {
    factors.push({ label: "Actual cost exceeds estimated budget", deduction: OPERATIONS_DEDUCTIONS.budgetOverrun, domain: "budget" });
  }
  if (context.daysSinceLastActivity !== null && context.daysSinceLastActivity >= 14) {
    factors.push({ label: "No recorded activity in 14+ days", deduction: OPERATIONS_DEDUCTIONS.noRecentActivity, domain: "timeline" });
  }
  if (context.documentCount === 0) {
    factors.push({ label: "No documents on file", deduction: OPERATIONS_DEDUCTIONS.missingDocuments, domain: "documents" });
  }

  return factors;
}

function bandFromScore(score: number): OperationsHealthBand {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 45) return "attention";
  return "critical";
}

/** Combines eventHealth.ts's own checklist/schedule/deposit factors with the new operational ones, on the same 0-100 scale. */
export function getOperationsHealth(context: OperationsHealthContext): OperationsHealthDetails {
  const base = getEventHealthDetails(context.event, context.eventHealthContext);
  const baseFactors: OperationsHealthFactor[] = base.factors.map((factor) => ({
    label: factor.label,
    deduction: factor.deduction,
    domain: "checklist",
  }));
  const operationsFactors = getOperationsFactors(context);
  const allFactors = [...baseFactors, ...operationsFactors].sort((a, b) => b.deduction - a.deduction);
  const totalDeduction = allFactors.reduce((sum, factor) => sum + factor.deduction, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeduction));

  return { score, band: bandFromScore(score), factors: allFactors };
}

export function isValidOperationsHealthBand(value: string): value is OperationsHealthBand {
  return (OPERATIONS_HEALTH_BANDS as readonly string[]).includes(value);
}
