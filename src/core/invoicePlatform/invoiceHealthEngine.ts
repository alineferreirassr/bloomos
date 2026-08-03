import type { InvoiceBuilderState, InvoiceHealth, InvoiceHealthCategoryScore, InvoiceVersion } from "@/types/invoicePlatform";
import { scheduleMatchesTotal } from "@/core/invoicePlatform/installmentEngine";

/**
 * v2.0 Checkpoint 35 — Invoice Health Engine (Step 10). Mirrors Business
 * Health's own `categoryFrom*`/"average of non-null scores" pattern
 * (`core/knowledge/businessHealthEngine.ts`, Checkpoint 25) rather than
 * importing it directly — `HealthCategory` there is a closed 11-item union,
 * not extensible with these 7 Invoice-specific categories, the same
 * parallel-implementation discipline `computeContractHealth` (Checkpoint
 * 34) already established.
 */

function scoreCategory(category: InvoiceHealthCategoryScore["category"], score: number, issues: string[]): InvoiceHealthCategoryScore {
  return { category, score: Math.max(0, Math.min(100, Math.round(score))), issues, notApplicableReason: null };
}

function notApplicable(category: InvoiceHealthCategoryScore["category"], reason: string): InvoiceHealthCategoryScore {
  return { category, score: null, issues: [], notApplicableReason: reason };
}

export interface ComputeInvoiceHealthInput {
  builderState: InvoiceBuilderState | null;
  currentVersion: InvoiceVersion | null;
  hasClient: boolean;
  hasLinkedProposal: boolean;
  hasLinkedContract: boolean;
  /** The real `Invoice.issue_date`/`due_date` — checked here since they live on the real entity, never the document snapshot. */
  invoiceIssueDate: string | null;
  invoiceDueDate: string | null;
  evaluatedAt: string;
}

export function computeInvoiceHealth(input: ComputeInvoiceHealthInput): InvoiceHealth {
  const { currentVersion } = input;
  const snapshot = currentVersion?.snapshot ?? null;

  const categories: InvoiceHealthCategoryScore[] = [];

  // completeness
  if (!snapshot) {
    categories.push(notApplicable("completeness", "No invoice document has been built yet."));
  } else {
    const checks: Array<[boolean, string]> = [
      [snapshot.header.title.trim().length > 0, "Header title is missing."],
      [snapshot.lineItems.length > 0, "No line items have been added."],
      [snapshot.terms.trim().length > 0, "Terms are missing."],
      [snapshot.policies.trim().length > 0, "Policies are missing."],
      [snapshot.footer.text.trim().length > 0, "Footer is missing."],
    ];
    const failed = checks.filter(([ok]) => !ok);
    categories.push(scoreCategory("completeness", ((checks.length - failed.length) / checks.length) * 100, failed.map(([, issue]) => issue)));
  }

  // pricing_health
  if (!snapshot) {
    categories.push(notApplicable("pricing_health", "No invoice document has been built yet."));
  } else {
    const checks: Array<[boolean, string]> = [
      [snapshot.pricing.grandTotal_minor > 0, "Grand total is zero."],
      [snapshot.pricing.discountsTotal_minor <= snapshot.pricing.lineItemsSubtotal_minor, "Discounts exceed the line items subtotal."],
      [snapshot.pricing.currency.trim().length === 3, "Currency is not set."],
    ];
    const failed = checks.filter(([ok]) => !ok);
    categories.push(scoreCategory("pricing_health", ((checks.length - failed.length) / checks.length) * 100, failed.map(([, issue]) => issue)));
  }

  // schedule_health
  if (!snapshot) {
    categories.push(notApplicable("schedule_health", "No invoice document has been built yet."));
  } else if (snapshot.paymentSchedule.length === 0) {
    categories.push(notApplicable("schedule_health", "No payment schedule has been set yet."));
  } else {
    const matches = scheduleMatchesTotal(snapshot.paymentSchedule, snapshot.pricing.grandTotal_minor);
    categories.push(scoreCategory("schedule_health", matches ? 100 : 50, matches ? [] : ["Payment schedule does not sum to the grand total."]));
  }

  // required_fields — the real Invoice's own core fields (issue date, due date), never the document snapshot
  {
    const checks: Array<[boolean, string]> = [
      [input.invoiceIssueDate !== null, "Issue date is not set."],
      [input.invoiceDueDate !== null, "Due date is not set."],
    ];
    const failed = checks.filter(([ok]) => !ok);
    categories.push(scoreCategory("required_fields", ((checks.length - failed.length) / checks.length) * 100, failed.map(([, issue]) => issue)));
  }

  // client_link
  categories.push(scoreCategory("client_link", input.hasClient ? 100 : 0, input.hasClient ? [] : ["No linked client record."]));

  // proposal_link
  categories.push(scoreCategory("proposal_link", input.hasLinkedProposal ? 100 : 0, input.hasLinkedProposal ? [] : ["No linked Proposal was found for this invoice's event."]));

  // contract_link
  categories.push(scoreCategory("contract_link", input.hasLinkedContract ? 100 : 0, input.hasLinkedContract ? [] : ["No linked Contract record."]));

  const scored = categories.filter((c): c is InvoiceHealthCategoryScore & { score: number } => c.score !== null);
  const overallScore = scored.length === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);

  return { categories, overallScore, evaluatedAt: input.evaluatedAt };
}
