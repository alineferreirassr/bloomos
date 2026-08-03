import type { Invoice } from "@/types/invoice";
import type { InvoiceAdjustment, InvoiceBuilderState, InvoiceFooterContent, InvoiceHeaderContent, InvoiceInstallment, InvoiceLineItem, InvoicePricingBreakdown, InvoiceSection, InvoiceSnapshot, InvoiceTemplate, InvoiceVersion } from "@/types/invoicePlatform";

/** v2.0 Checkpoint 35 — shared fixture builders for engine tests, mirroring `core/contractPlatform/testFixtures.ts` (Checkpoint 34) precedent. Not a test file itself. */

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}_test_${sequence}`;
}

export function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  const now = new Date().toISOString();
  return {
    id: nextId("invoice"),
    workspace_id: "ws_test",
    client_id: nextId("client"),
    event_id: nextId("event"),
    contract_id: null,
    invoice_number: "INV-0001",
    title: "Luxury Picnic Invoice",
    description: null,
    status: "draft",
    issue_date: now,
    due_date: null,
    subtotal_minor: 65000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 65000,
    paid_minor: 0,
    balance_minor: 65000,
    currency: "USD",
    notes: null,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function makeHeader(overrides: Partial<InvoiceHeaderContent> = {}): InvoiceHeaderContent {
  return { title: "Luxury Event Invoice", subtitle: null, logoAssetId: null, ...overrides };
}

export function makeFooter(overrides: Partial<InvoiceFooterContent> = {}): InvoiceFooterContent {
  return { text: "Thank you for choosing Amoré Bloom.", contactEmail: "hello@amorebloom.test", contactPhone: null, ...overrides };
}

export function makeSection(overrides: Partial<InvoiceSection> = {}): InvoiceSection {
  return { id: nextId("invoice_section"), title: "Services", isCustom: false, ...overrides };
}

export function makeLineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    id: nextId("invoice_line_item"),
    sectionId: null,
    kind: "service",
    label: "Luxury Picnic Package",
    description: null,
    quantity: 1,
    unitPrice_minor: 65000,
    amount_minor: 65000,
    ...overrides,
  };
}

export function makeAdjustment(overrides: Partial<InvoiceAdjustment> = {}): InvoiceAdjustment {
  return { id: nextId("invoice_adjustment"), kind: "manual_adjustment", label: "Manual Adjustment", amount_minor: -1000, notes: null, sourceInvoiceId: null, ...overrides };
}

export function makeInstallment(overrides: Partial<InvoiceInstallment> = {}): InvoiceInstallment {
  return { id: nextId("invoice_installment"), kind: "final_payment", label: "Payment in Full", dueDate: null, amount_minor: 65000, ...overrides };
}

export function makePricing(overrides: Partial<InvoicePricingBreakdown> = {}): InvoicePricingBreakdown {
  return {
    currency: "USD",
    lineItemsSubtotal_minor: 65000,
    discountsTotal_minor: 0,
    taxPlaceholderTotal_minor: 0,
    adjustmentsTotal_minor: 0,
    subtotal_minor: 65000,
    grandTotal_minor: 65000,
    depositDue_minor: 0,
    remainingBalance_minor: 65000,
    installmentsTotal_minor: 65000,
    paidToDate_minor: 0,
    outstandingBalance_minor: 65000,
    ...overrides,
  };
}

export function makeSnapshot(overrides: Partial<InvoiceSnapshot> = {}): InvoiceSnapshot {
  return {
    id: nextId("invoice_snapshot"),
    captured_at: new Date().toISOString(),
    templateId: nextId("invoice_template"),
    templateKey: "luxury_event",
    header: makeHeader(),
    sections: [makeSection()],
    lineItems: [makeLineItem()],
    adjustments: [],
    paymentSchedule: [makeInstallment()],
    pricing: makePricing(),
    terms: "Standard terms apply.",
    policies: "Standard cancellation policy applies.",
    notes: "",
    footer: makeFooter(),
    ...overrides,
  };
}

export function makeVersion(overrides: Partial<InvoiceVersion> = {}): InvoiceVersion {
  return {
    id: nextId("invoice_version"),
    invoice_id: nextId("invoice"),
    workspace_id: "ws_test",
    version_number: 1,
    snapshot: makeSnapshot(),
    reason: null,
    created_by: "member_test",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function makeBuilderState(overrides: Partial<InvoiceBuilderState> = {}): InvoiceBuilderState {
  const version = makeVersion();
  const now = new Date().toISOString();
  return {
    id: nextId("invoice_builder"),
    invoice_id: version.invoice_id,
    workspace_id: "ws_test",
    status: "draft",
    current_version_id: version.id,
    versions: [version],
    ready_at: null,
    archived_at: null,
    created_by: "member_test",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function makeTemplate(overrides: Partial<InvoiceTemplate> = {}): InvoiceTemplate {
  const now = new Date().toISOString();
  return {
    id: nextId("invoice_template"),
    workspace_id: "ws_test",
    key: "luxury_event",
    name: "Luxury Event",
    description: "A full-service luxury event invoice.",
    isSystemTemplate: true,
    structure: {
      header: makeHeader(),
      defaultSectionTitles: ["Services", "Fees"],
      defaultPaymentScheduleKind: "deposit_final",
      footer: makeFooter(),
    },
    created_by: "system",
    created_at: now,
    updated_at: now,
    archived_at: null,
    ...overrides,
  };
}
