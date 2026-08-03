import type { Invoice } from "@/types/invoice";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";

/**
 * v2.0 Checkpoint 35 — Invoice & Billing Platform. `Invoice`
 * (`types/invoice.ts`, real Supabase-backed entity, dual-backend mock +
 * Supabase repository) stays the single source of truth for the invoice's
 * own commercial/collection lifecycle (`status`, `issueInvoice`/
 * `sendInvoice`/`markInvoiceViewed`/`markInvoiceOverdue`/`voidInvoice`/
 * `archiveInvoice`/`restoreInvoice` in `lib/data/finance/`, and
 * `paid_minor`/`balance_minor` derived exclusively by `applyPaymentToInvoice`
 * from real `Payment` rows) — nothing here duplicates it. Everything in this
 * file is an ADDITIVE layer on top of an existing `Invoice.id`: the
 * human-curated document (template, line items, sections, adjustments,
 * payment schedule, pricing breakdown) that gets built, versioned, compared,
 * and prepared — never the real invoice record, and never real payment
 * processing.
 *
 * The real `Invoice` has no `line_items`, `payments` array, `deposit_amount`,
 * `installments`, or `version`/`version_history` — it is deliberately flat
 * (one subtotal/tax/discount/total). This checkpoint fills exactly that gap,
 * the same way Contract Platform (Checkpoint 34) added `sections`/`clauses`/
 * versions on top of an equally flat real `Contract`.
 *
 * `Payment` (`types/payment.ts`) is the real, already-existing entity that
 * records actual money movement (`payment_type`: deposit/installment/
 * final_payment/full_payment/retainer/reimbursement/refund/adjustment/other;
 * `status`: pending/processing/succeeded/failed/partially_refunded/refunded/
 * cancelled). This checkpoint's own `InvoiceInstallment`/`InvoicePaymentSchedule`
 * model a PLAN only (dates and amounts a client is expected to pay) — never a
 * second money-movement ledger. "Paid"/"Outstanding Balance" always read the
 * real `Invoice.paid_minor`/`balance_minor` (themselves derived from real
 * `Payment` rows), never recomputed here — see `billingEngine.ts`.
 */

export type { Invoice } from "@/types/invoice";
export type { InvoiceStatus } from "@/core/enums/invoiceStatus";

// ---------------------------------------------------------------------------
// Step 2 — Invoice Template Library
// ---------------------------------------------------------------------------

export const INVOICE_TEMPLATE_KEYS = [
  "luxury_event",
  "proposal_deposit",
  "final_balance",
  "photography",
  "ugc_services",
  "digital_products",
  "vendor_invoice",
  "refund",
  "credit_memo",
  "custom_template",
] as const;
export type InvoiceTemplateKey = (typeof INVOICE_TEMPLATE_KEYS)[number];

export const INVOICE_TEMPLATE_LABELS: Record<InvoiceTemplateKey, string> = {
  luxury_event: "Luxury Event",
  proposal_deposit: "Proposal Deposit",
  final_balance: "Final Balance",
  photography: "Photography",
  ugc_services: "UGC Services",
  digital_products: "Digital Products",
  vendor_invoice: "Vendor Invoice",
  refund: "Refund",
  credit_memo: "Credit Memo",
  custom_template: "Custom Template",
};

export interface InvoiceHeaderContent {
  title: string;
  subtitle: string | null;
  logoAssetId: string | null;
}

export interface InvoiceFooterContent {
  text: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

/** A template names its own default section titles and default payment-schedule kind — line items are always authored per invoice, never templated. */
export interface InvoiceTemplateStructure {
  header: InvoiceHeaderContent;
  defaultSectionTitles: string[];
  defaultPaymentScheduleKind: InvoicePaymentScheduleKind;
  footer: InvoiceFooterContent;
}

export interface InvoiceTemplate {
  id: string;
  workspace_id: string;
  key: InvoiceTemplateKey;
  name: string;
  description: string;
  isSystemTemplate: boolean;
  structure: InvoiceTemplateStructure;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

// ---------------------------------------------------------------------------
// Step 4 — Line Item Engine
// ---------------------------------------------------------------------------

export const INVOICE_LINE_ITEM_KINDS = ["service", "package", "product", "fee", "travel", "rental", "labor", "discount", "tax_placeholder"] as const;
export type InvoiceLineItemKind = (typeof INVOICE_LINE_ITEM_KINDS)[number];

export const INVOICE_LINE_ITEM_KIND_LABELS: Record<InvoiceLineItemKind, string> = {
  service: "Service",
  package: "Package",
  product: "Product",
  fee: "Fee",
  travel: "Travel",
  rental: "Rental",
  labor: "Labor",
  discount: "Discount",
  tax_placeholder: "Tax (Placeholder)",
};

/**
 * `amount_minor` is signed — negative for `discount`/`tax_placeholder`
 * reductions, positive for every revenue kind. `"tax_placeholder"` exists so
 * a workspace can show a labeled tax line without this checkpoint ever
 * calculating or remitting real tax — the amount is always whatever the
 * author typed, never computed from a rate table.
 */
export interface InvoiceLineItem {
  id: string;
  sectionId: string | null;
  kind: InvoiceLineItemKind;
  label: string;
  description: string | null;
  quantity: number;
  unitPrice_minor: number;
  amount_minor: number;
}

export interface InvoiceSection {
  id: string;
  title: string;
  isCustom: boolean;
}

// ---------------------------------------------------------------------------
// Step 7 — Credit & Adjustment Engine
// ---------------------------------------------------------------------------

export const INVOICE_ADJUSTMENT_KINDS = ["credit", "manual_adjustment", "refund_placeholder", "service_credit", "invoice_credit", "balance_carry_forward"] as const;
export type InvoiceAdjustmentKind = (typeof INVOICE_ADJUSTMENT_KINDS)[number];

export const INVOICE_ADJUSTMENT_KIND_LABELS: Record<InvoiceAdjustmentKind, string> = {
  credit: "Credit",
  manual_adjustment: "Manual Adjustment",
  refund_placeholder: "Refund (Placeholder)",
  service_credit: "Service Credit",
  invoice_credit: "Invoice Credit",
  balance_carry_forward: "Balance Carry Forward",
};

/**
 * A dedicated, separate list from `lineItems` — the spec names
 * `InvoiceAdjustment` as its own top-level domain type, and Step 7 as its
 * own engine, distinct from Step 4's Line Item Engine. `amount_minor` is
 * always negative (every named kind reduces what's owed) except
 * `balance_carry_forward`, which is positive (it ADDS a prior invoice's
 * unpaid balance onto this one). `"refund_placeholder"` never triggers a
 * real refund — see `docs/billing-engine.md`.
 */
export interface InvoiceAdjustment {
  id: string;
  kind: InvoiceAdjustmentKind;
  label: string;
  amount_minor: number;
  notes: string | null;
  /** Only set for `balance_carry_forward` — the prior `Invoice.id` this balance was carried from. */
  sourceInvoiceId: string | null;
}

// ---------------------------------------------------------------------------
// Step 6 — Installment Engine
// ---------------------------------------------------------------------------

export const INVOICE_PAYMENT_SCHEDULE_KINDS = ["single_payment", "two_payments", "three_payments", "custom_schedule", "deposit_final", "milestone_payments"] as const;
export type InvoicePaymentScheduleKind = (typeof INVOICE_PAYMENT_SCHEDULE_KINDS)[number];

export const INVOICE_PAYMENT_SCHEDULE_KIND_LABELS: Record<InvoicePaymentScheduleKind, string> = {
  single_payment: "Single Payment",
  two_payments: "Two Payments",
  three_payments: "Three Payments",
  custom_schedule: "Custom Schedule",
  deposit_final: "Deposit + Final Payment",
  milestone_payments: "Milestone Payments",
};

export const INVOICE_INSTALLMENT_KINDS = ["deposit", "installment", "final_payment", "milestone"] as const;
export type InvoiceInstallmentKind = (typeof INVOICE_INSTALLMENT_KINDS)[number];

/**
 * A planned payment — dates and amounts a client is expected to pay. Never a
 * real charge and never itself marked "paid": whether an installment has
 * actually been collected is read by matching it against real `Payment`
 * rows for this invoice (by amount/date proximity) at render time, never
 * stored as a flag here, so this record can never drift from the real
 * ledger.
 */
export interface InvoiceInstallment {
  id: string;
  kind: InvoiceInstallmentKind;
  label: string;
  dueDate: string | null;
  amount_minor: number;
}

// ---------------------------------------------------------------------------
// Step 5 — Billing Engine output
// ---------------------------------------------------------------------------

/**
 * Every field here is derived, never independently authored.
 * `paidToDate_minor`/`outstandingBalance_minor` are computed from the real
 * `Invoice.paid_minor` the caller passes in — reused, never recomputed from
 * a second ledger.
 */
export interface InvoicePricingBreakdown {
  currency: string;
  lineItemsSubtotal_minor: number;
  discountsTotal_minor: number;
  taxPlaceholderTotal_minor: number;
  adjustmentsTotal_minor: number;
  subtotal_minor: number;
  grandTotal_minor: number;
  depositDue_minor: number;
  remainingBalance_minor: number;
  installmentsTotal_minor: number;
  /** Echoes the real `Invoice.paid_minor` at capture time — a frozen reference, never a second source of truth. */
  paidToDate_minor: number;
  outstandingBalance_minor: number;
}

// ---------------------------------------------------------------------------
// Step 1 + 8 — Snapshot, Version, and the builder shell
// ---------------------------------------------------------------------------

export interface InvoiceSnapshot {
  id: string;
  captured_at: string;
  templateId: string | null;
  templateKey: InvoiceTemplateKey | null;
  header: InvoiceHeaderContent;
  sections: InvoiceSection[];
  lineItems: InvoiceLineItem[];
  adjustments: InvoiceAdjustment[];
  paymentSchedule: InvoiceInstallment[];
  pricing: InvoicePricingBreakdown;
  terms: string;
  policies: string;
  notes: string;
  footer: InvoiceFooterContent;
}

export interface InvoiceVersion {
  id: string;
  invoice_id: string;
  workspace_id: string;
  version_number: number;
  snapshot: InvoiceSnapshot;
  reason: string | null;
  created_by: string;
  created_at: string;
}

export const INVOICE_DOCUMENT_STATUSES = ["draft", "review", "published", "archived"] as const;
export type InvoiceDocumentStatus = (typeof INVOICE_DOCUMENT_STATUSES)[number];

/**
 * The mutable shell around append-only `InvoiceVersion` history — the exact
 * `ContractBuilderState`/`ProposalBuilderState` pattern, scoped to this
 * checkpoint's own document-authoring concerns and kept entirely separate
 * from the real `Invoice` row (see this file's top-level doc comment).
 * Deliberately labeled "Document" everywhere in the UI to avoid colliding
 * with the real Invoice's own status machine and its existing Issue/Send/
 * Void/Archive actions.
 */
export interface InvoiceBuilderState {
  id: string;
  invoice_id: string;
  workspace_id: string;
  status: InvoiceDocumentStatus;
  current_version_id: string | null;
  versions: InvoiceVersion[];
  /** Set the first time Readiness reaches `"ready"` — never cleared once set. */
  ready_at: string | null;
  archived_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceVersionInput {
  templateId: string | null;
  templateKey: InvoiceTemplateKey | null;
  header: InvoiceHeaderContent;
  sections: InvoiceSection[];
  lineItems: InvoiceLineItem[];
  adjustments: InvoiceAdjustment[];
  paymentSchedule: InvoiceInstallment[];
  terms: string;
  policies: string;
  notes: string;
  footer: InvoiceFooterContent;
  reason: string | null;
}

// ---------------------------------------------------------------------------
// Step 9 — Comparison Engine
// ---------------------------------------------------------------------------

export const INVOICE_DIFF_CATEGORIES = ["amounts", "line_items", "terms", "installments", "credits", "discounts", "notes", "policies"] as const;
export type InvoiceDiffCategory = (typeof INVOICE_DIFF_CATEGORIES)[number];

export const INVOICE_DIFF_CHANGE_TYPES = ["added", "removed", "changed"] as const;
export type InvoiceDiffChangeType = (typeof INVOICE_DIFF_CHANGE_TYPES)[number];

export interface InvoiceDiffEntry {
  category: InvoiceDiffCategory;
  field: string;
  before: string | null;
  after: string | null;
  changeType: InvoiceDiffChangeType;
}

export interface InvoiceComparisonResult {
  versionANumber: number;
  versionBNumber: number;
  diffs: InvoiceDiffEntry[];
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Step 10 — Invoice Health Engine
// ---------------------------------------------------------------------------

export const INVOICE_HEALTH_CATEGORIES = ["completeness", "pricing_health", "schedule_health", "required_fields", "client_link", "proposal_link", "contract_link"] as const;
export type InvoiceHealthCategory = (typeof INVOICE_HEALTH_CATEGORIES)[number];

export const INVOICE_HEALTH_CATEGORY_LABELS: Record<InvoiceHealthCategory, string> = {
  completeness: "Completeness",
  pricing_health: "Pricing Health",
  schedule_health: "Schedule Health",
  required_fields: "Required Fields",
  client_link: "Client Link",
  proposal_link: "Proposal Link",
  contract_link: "Contract Link",
};

export interface InvoiceHealthCategoryScore {
  category: InvoiceHealthCategory;
  score: number | null;
  issues: string[];
  notApplicableReason: string | null;
}

export interface InvoiceHealth {
  categories: InvoiceHealthCategoryScore[];
  overallScore: number;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Step 11 — Invoice Readiness
// ---------------------------------------------------------------------------

export const INVOICE_READINESS_STATES = ["ready", "needs_review", "missing_client", "missing_proposal", "missing_contract", "missing_pricing", "missing_schedule", "missing_terms"] as const;
export type InvoiceReadinessState = (typeof INVOICE_READINESS_STATES)[number];

export const INVOICE_READINESS_LABELS: Record<InvoiceReadinessState, string> = {
  ready: "Ready",
  needs_review: "Needs Review",
  missing_client: "Missing Client",
  missing_proposal: "Missing Proposal",
  missing_contract: "Missing Contract",
  missing_pricing: "Missing Pricing",
  missing_schedule: "Missing Schedule",
  missing_terms: "Missing Terms",
};

export interface InvoiceReadinessResult {
  state: InvoiceReadinessState;
  reasons: string[];
  canPublish: boolean;
}

// ---------------------------------------------------------------------------
// Step 13 — Invoice Analytics
// ---------------------------------------------------------------------------

export interface InvoiceAnalyticsSnapshot {
  totalInvoices: number;
  draftCount: number;
  reviewCount: number;
  publishedCount: number;
  archivedCount: number;
  averageInvoice_minor: number;
  averageDeposit_minor: number;
  averageBalance_minor: number;
  averageDiscount_minor: number;
  averageCredit_minor: number;
  averageInstallments: number;
  outstandingBalance_minor: number;
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Composed read models (never persisted, computed fresh)
// ---------------------------------------------------------------------------

export interface InvoiceSummary {
  invoiceId: string;
  clientId: string;
  eventId: string | null;
  contractId: string | null;
  documentStatus: InvoiceDocumentStatus;
  invoiceStatus: InvoiceStatus;
  currentVersionNumber: number | null;
  templateKey: InvoiceTemplateKey | null;
  grandTotal_minor: number | null;
  currency: string;
  overallHealthScore: number;
  readinessState: InvoiceReadinessState;
  readyAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  builderState: InvoiceBuilderState | null;
  currentVersion: InvoiceVersion | null;
  health: InvoiceHealth;
  readiness: InvoiceReadinessResult;
}
