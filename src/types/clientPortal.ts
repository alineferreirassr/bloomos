import type { EventType } from "@/core/enums/eventType";
import type { EventStatus } from "@/core/enums/eventStatus";
import type { ContractStatus } from "@/core/enums/contractStatus";
import type { SignatureStatus } from "@/core/enums/signatureStatus";
import type { InvoiceStatus } from "@/core/enums/invoiceStatus";
import type { PaymentType } from "@/core/enums/paymentType";
import type { PaymentStatus } from "@/core/enums/paymentStatus";
import type { PaymentMethod } from "@/core/enums/paymentMethod";
import type { DocumentCategory } from "@/core/enums/documentCategory";
import type { DocumentStatus } from "@/core/enums/documentStatus";

/**
 * Client-safe projections — deliberately their own types, not `Pick<Event,...>`
 * aliases, so a future field added to the internal `Event`/`Contract`/etc.
 * types is never accidentally forwarded to the Client Portal just because
 * a `Pick` happened to reference it. Every field here has been individually
 * reviewed against the internal type's own fields (see the Client Portal
 * MVP pre-implementation audit, docs/permissions.md) — nothing internal-only
 * (budget, staff assignment, internal notes, confidentiality/accessibility/
 * dietary notes, refund-tracking references, raw storage paths) is ever
 * included. Repository functions returning these types must select exactly
 * these columns server-side — never `select("*")` and hide fields in the UI.
 */

export interface ClientPortalEvent {
  id: string;
  client_id: string;
  title: string;
  event_type: EventType;
  status: EventStatus;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  location_name: string | null;
  city: string | null;
  state: string | null;
  guest_count: number | null;
  package_name: string | null;
  theme: string | null;
  color_palette: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ClientPortalContract {
  id: string;
  client_id: string;
  event_id: string | null;
  contract_number: string;
  title: string;
  description: string | null;
  status: ContractStatus;
  signature_status: SignatureStatus;
  effective_date: string | null;
  expiration_date: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  total_value: number | null;
  deposit_required: boolean;
  deposit_amount: number | null;
  remaining_balance: number | null;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalPayment {
  id: string;
  invoice_id: string | null;
  payment_type: PaymentType;
  status: PaymentStatus;
  amount_minor: number;
  currency: string;
  payment_method: PaymentMethod;
  transaction_date: string;
  received_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface ClientPortalInvoice {
  id: string;
  client_id: string;
  event_id: string | null;
  contract_id: string | null;
  invoice_number: string;
  title: string;
  description: string | null;
  status: InvoiceStatus;
  issue_date: string | null;
  due_date: string | null;
  subtotal_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
  paid_minor: number;
  balance_minor: number;
  currency: string;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  overdue_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalInvoiceWithPayments extends ClientPortalInvoice {
  payments: ClientPortalPayment[];
}

export interface ClientPortalDocument {
  id: string;
  title: string;
  description: string | null;
  category: DocumentCategory;
  status: DocumentStatus;
  file_name: string | null;
  original_file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  version: number;
  is_latest_version: boolean;
  hasFile: boolean;
  uploaded_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientPortalOverview {
  clientName: string;
  upcomingEvent: ClientPortalEvent | null;
  contractsInProgress: number;
  totalOutstandingBalanceMinor: number;
  currency: string;
  nextPaymentDue: { invoiceId: string; invoiceNumber: string; dueDate: string | null; balanceMinor: number } | null;
  recentDocuments: ClientPortalDocument[];
  nextRecommendedAction: string | null;
}
