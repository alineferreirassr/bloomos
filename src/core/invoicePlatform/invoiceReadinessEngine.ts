import type { InvoiceHealth, InvoiceReadinessResult, InvoiceReadinessState, InvoiceVersion } from "@/types/invoicePlatform";

/**
 * v2.0 Checkpoint 35 — Invoice Readiness (Step 11). A waterfall over
 * already-computed facts — the same "first unmet requirement wins" shape
 * `evaluateContractReadiness` (Checkpoint 34) established. `missing_proposal`/
 * `missing_contract` are checked unconditionally (the same way Contract's
 * own readiness unconditionally requires a linked Proposal) even though the
 * real `Invoice` itself allows a fully standalone transaction — a stricter,
 * disclosed bar for this Document layer's own "ready to publish" signal,
 * not a requirement to use the Invoice Platform at all. See
 * `docs/invoice-health.md`.
 */

const READY_HEALTH_THRESHOLD = 70;

export interface EvaluateInvoiceReadinessInput {
  currentVersion: InvoiceVersion | null;
  hasClient: boolean;
  hasLinkedProposal: boolean;
  hasLinkedContract: boolean;
  health: InvoiceHealth;
}

export function evaluateInvoiceReadiness(input: EvaluateInvoiceReadinessInput): InvoiceReadinessResult {
  const snapshot = input.currentVersion?.snapshot ?? null;

  const rules: Array<[boolean, InvoiceReadinessState, string]> = [
    [!input.hasClient, "missing_client", "This invoice has no linked client record."],
    [snapshot === null, "missing_pricing", "No invoice document has been built yet."],
    [snapshot !== null && snapshot.pricing.grandTotal_minor <= 0, "missing_pricing", "The invoice grand total is zero."],
    [snapshot !== null && snapshot.paymentSchedule.length === 0, "missing_schedule", "No payment schedule has been set."],
    [snapshot !== null && snapshot.terms.trim().length === 0, "missing_terms", "Terms have not been entered."],
    [!input.hasLinkedProposal, "missing_proposal", "No Proposal is linked to this invoice's event."],
    [!input.hasLinkedContract, "missing_contract", "No Contract is linked to this invoice."],
    [input.health.overallScore < READY_HEALTH_THRESHOLD, "needs_review", `Overall invoice health (${input.health.overallScore}) is below the ${READY_HEALTH_THRESHOLD} threshold.`],
  ];

  for (const [triggered, state, reason] of rules) {
    if (triggered) return { state, reasons: [reason], canPublish: false };
  }

  return { state: "ready", reasons: [], canPublish: true };
}
