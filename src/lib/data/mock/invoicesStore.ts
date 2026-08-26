import type { Invoice } from "@/types/invoice";
import type { InvoiceInput } from "@/modules/finance/schema";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * One seed Invoice per required status (draft, sent, partially_paid, paid,
 * overdue, voided — `paid` appears twice), linked to the existing seed
 * Clients/Events/Contracts where the chain is naturally populated, and left
 * standalone (`event_id`/`contract_id` both null) for invoice_7 to exercise
 * the "Invoice without an Event or Contract" case the model explicitly
 * allows. All money fields are integer minor units (see lib/money.ts).
 */
const SEED_INVOICES: Invoice[] = [
  {
    id: "invoice_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_2",
    event_id: "event_1",
    contract_id: "contract_1",
    invoice_number: "INV-2026-0001",
    title: "Malibu Sunset Proposal — Deposit Invoice",
    description: "Deposit due to secure the proposal date.",
    status: "paid",
    issue_date: "2026-06-11",
    due_date: "2026-06-18",
    subtotal_minor: 250000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 250000,
    paid_minor: 250000,
    balance_minor: 0,
    currency: "USD",
    notes: null,
    sent_at: "2026-06-11T09:15:00.000Z",
    viewed_at: "2026-06-11T20:00:00.000Z",
    paid_at: "2026-06-11T21:30:00.000Z",
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-06-11T09:00:00.000Z",
    updated_at: "2026-06-11T21:30:00.000Z",
  },
  {
    id: "invoice_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_2",
    event_id: "event_1",
    contract_id: "contract_1",
    invoice_number: "INV-2026-0002",
    title: "Malibu Sunset Proposal — Final Balance",
    description: "Remaining balance due ahead of the proposal date.",
    status: "partially_paid",
    issue_date: "2026-07-01",
    due_date: "2026-08-15",
    subtotal_minor: 600000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 600000,
    paid_minor: 300000,
    balance_minor: 300000,
    currency: "USD",
    notes: "Installment received via bank transfer; final payment pending.",
    sent_at: "2026-07-01T10:00:00.000Z",
    viewed_at: "2026-07-02T08:00:00.000Z",
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-07-01T09:30:00.000Z",
    updated_at: "2026-07-05T13:00:00.000Z",
  },
  {
    id: "invoice_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_1",
    event_id: "event_4",
    contract_id: "contract_7",
    invoice_number: "INV-2026-0003",
    title: "Whitfield In-Home Setup — Full Invoice",
    description: "Full invoice for the in-home romantic setup.",
    status: "partially_paid",
    issue_date: "2026-06-05",
    due_date: "2026-06-12",
    subtotal_minor: 140000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 140000,
    paid_minor: 120000,
    balance_minor: 20000,
    currency: "USD",
    notes: "Paid in full on delivery; partially refunded after a rescheduled add-on service.",
    sent_at: "2026-06-05T11:00:00.000Z",
    viewed_at: "2026-06-05T15:00:00.000Z",
    paid_at: "2026-06-05T16:00:00.000Z",
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-06-05T10:30:00.000Z",
    updated_at: "2026-06-20T12:00:00.000Z",
  },
  {
    id: "invoice_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_3",
    event_id: "event_2",
    contract_id: "contract_3",
    invoice_number: "INV-2026-0004",
    title: "Casey's Birthday Hotel Suite — Deposit Invoice",
    description: "Deposit invoice for the hotel suite decor package.",
    status: "sent",
    issue_date: "2026-07-10",
    due_date: "2026-07-20",
    subtotal_minor: 50000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 50000,
    paid_minor: 0,
    balance_minor: 50000,
    currency: "USD",
    notes: null,
    sent_at: "2026-07-10T09:00:00.000Z",
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-07-10T08:45:00.000Z",
    updated_at: "2026-07-10T09:00:00.000Z",
  },
  {
    id: "invoice_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_4",
    event_id: "event_5",
    contract_id: null,
    invoice_number: "INV-2026-0005",
    title: "Sonoma Vineyard Picnic — Deposit Invoice",
    description: "Deposit invoice sent ahead of the contract being finalized.",
    status: "overdue",
    issue_date: "2026-06-01",
    due_date: "2026-06-15",
    subtotal_minor: 50000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 50000,
    paid_minor: 0,
    balance_minor: 50000,
    currency: "USD",
    notes: "Isabella hasn't confirmed the deposit yet — follow up.",
    sent_at: "2026-06-01T10:00:00.000Z",
    viewed_at: "2026-06-02T09:00:00.000Z",
    paid_at: null,
    overdue_at: "2026-06-16T00:00:00.000Z",
    voided_at: null,
    archived_at: null,
    created_at: "2026-06-01T09:30:00.000Z",
    updated_at: "2026-06-16T00:00:00.000Z",
  },
  {
    id: "invoice_6",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_1",
    event_id: "event_3",
    contract_id: null,
    invoice_number: "INV-2026-0006",
    title: "Whitfield Anniversary Dinner — Proposal Invoice",
    description: "Draft invoice, not yet issued — pending contract sign-off.",
    status: "draft",
    issue_date: null,
    due_date: null,
    subtotal_minor: 90000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 90000,
    paid_minor: 0,
    balance_minor: 90000,
    currency: "USD",
    notes: null,
    sent_at: null,
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: null,
    archived_at: null,
    created_at: "2026-07-12T10:00:00.000Z",
    updated_at: "2026-07-12T10:00:00.000Z",
  },
  {
    id: "invoice_7",
    workspace_id: CURRENT_WORKSPACE_ID,
    client_id: "client_2",
    event_id: null,
    contract_id: null,
    invoice_number: "INV-2026-0007",
    title: "Jordan Ellis — Standalone Floral Consultation",
    description: "A one-off consultation invoiced with no linked Event or Contract.",
    status: "voided",
    issue_date: "2026-05-01",
    due_date: "2026-05-10",
    subtotal_minor: 15000,
    tax_minor: 0,
    discount_minor: 0,
    total_minor: 15000,
    paid_minor: 0,
    balance_minor: 15000,
    currency: "USD",
    notes: "Voided — Jordan rescheduled and was invoiced separately under the Malibu proposal.",
    sent_at: "2026-05-01T10:00:00.000Z",
    viewed_at: null,
    paid_at: null,
    overdue_at: null,
    voided_at: "2026-05-12T09:00:00.000Z",
    archived_at: null,
    created_at: "2026-05-01T09:30:00.000Z",
    updated_at: "2026-05-12T09:00:00.000Z",
  },
];

let invoices: Invoice[] = SEED_INVOICES.map((invoice) => ({ ...invoice }));

export function readInvoices(): Invoice[] {
  return invoices;
}

export function writeInvoices(next: Invoice[]): void {
  invoices = next;
}

/**
 * Finance F2.1C-F-E-D-B1: internal-only idempotency metadata, deliberately
 * kept OUT of the `Invoice` domain type — never exposed, never returned to
 * a caller, never touched by updateInvoice/issueInvoice/voidInvoice (which
 * only ever read/write plain `Invoice` records), and never populated by
 * duplicateInvoice (a distinct, always-new-resource action, never a
 * retry). Keyed by `${workspaceId}:${invoiceId}` so a replay lookup can
 * never see another workspace's snapshot. Mirrors the Supabase
 * `invoices.creation_request_snapshot` column's exact semantics.
 */
const invoiceCreationSnapshots = new Map<string, InvoiceInput>();

function snapshotKey(workspaceId: string, invoiceId: string): string {
  return `${workspaceId}:${invoiceId}`;
}

export function readInvoiceCreationSnapshot(workspaceId: string, invoiceId: string): InvoiceInput | undefined {
  return invoiceCreationSnapshots.get(snapshotKey(workspaceId, invoiceId));
}

export function writeInvoiceCreationSnapshot(workspaceId: string, invoiceId: string, snapshot: InvoiceInput): void {
  invoiceCreationSnapshots.set(snapshotKey(workspaceId, invoiceId), snapshot);
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetInvoicesStore(): void {
  invoices = SEED_INVOICES.map((invoice) => ({ ...invoice }));
  invoiceCreationSnapshots.clear();
}
