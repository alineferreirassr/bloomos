import type { RecommendationSeverity, OperationalRecommendation } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { Invoice } from "@/types/invoice";
import type { InvoiceDocumentStatus, InvoiceHealth, InvoicePricingBreakdown, InvoiceReadinessResult } from "@/types/invoicePlatform";

/**
 * v2.0 Checkpoint 35 — Executive Decisions Integration (Step 17). Pure
 * translation, the exact `contractHealthToRecommendations` seam
 * (`core/contractPlatform/contractExecutiveIntegration.ts`, Checkpoint 34)
 * — never a second recommendation or decision engine of the Invoice
 * Platform's own. 7 named rules, exactly as specified: Invoice Ready,
 * Invoice Missing Contract, Invoice Missing Proposal, Outstanding Balance,
 * Invoice Needs Review, Large Discount, High Value Invoice.
 * `HIGH_VALUE_MINOR` reuses the same threshold `proposalHealthToRecommendations`
 * established (Checkpoint 33) for consistency across the platform.
 * `LARGE_DISCOUNT_RATIO` is this checkpoint's own disclosed threshold — a
 * discount at or above 20% of the line items subtotal.
 */

const HIGH_VALUE_MINOR = 500_00;
const LARGE_DISCOUNT_RATIO = 0.2;

function recommendation(ruleId: string, message: string, severity: RecommendationSeverity, node: KnowledgeNodeRef): OperationalRecommendation {
  return { ruleId, message, severity, node };
}

export interface InvoiceExecutiveContext {
  invoice: Invoice;
  readiness: InvoiceReadinessResult;
  health: InvoiceHealth;
  documentStatus: InvoiceDocumentStatus | null;
  pricing: InvoicePricingBreakdown | null;
}

export function invoiceHealthToRecommendations(context: InvoiceExecutiveContext): OperationalRecommendation[] {
  const node: KnowledgeNodeRef = { nodeType: "invoice", nodeId: context.invoice.id };
  const recs: OperationalRecommendation[] = [];

  if (context.readiness.canPublish) {
    recs.push(recommendation("invoice_platform.ready", `Invoice document is ready to publish (health ${context.health.overallScore}).`, "info", node));
  } else if (context.readiness.state === "missing_contract") {
    recs.push(recommendation("invoice_platform.missing_contract", context.readiness.reasons[0] ?? "No Contract is linked to this invoice.", "warning", node));
  } else if (context.readiness.state === "missing_proposal") {
    recs.push(recommendation("invoice_platform.missing_proposal", context.readiness.reasons[0] ?? "No Proposal is linked to this invoice's event.", "warning", node));
  } else if (context.readiness.state === "needs_review") {
    recs.push(recommendation("invoice_platform.needs_review", context.readiness.reasons[0] ?? "Invoice document needs review.", "warning", node));
  }

  if (context.pricing) {
    if (context.documentStatus === "published" && context.pricing.outstandingBalance_minor > 0) {
      recs.push(recommendation("invoice_platform.outstanding_balance", `Invoice has an outstanding balance of ${(context.pricing.outstandingBalance_minor / 100).toFixed(2)}.`, "warning", node));
    }

    if (context.pricing.lineItemsSubtotal_minor > 0 && Math.abs(context.pricing.discountsTotal_minor) / context.pricing.lineItemsSubtotal_minor >= LARGE_DISCOUNT_RATIO) {
      recs.push(recommendation("invoice_platform.large_discount", `Invoice discount is ${Math.round((Math.abs(context.pricing.discountsTotal_minor) / context.pricing.lineItemsSubtotal_minor) * 100)}% of the line items subtotal.`, "warning", node));
    }

    if (context.pricing.grandTotal_minor >= HIGH_VALUE_MINOR) {
      recs.push(recommendation("invoice_platform.high_value_invoice", `A high-value invoice (${(context.pricing.grandTotal_minor / 100).toFixed(2)}) is in the pipeline.`, "info", node));
    }
  }

  return recs;
}
