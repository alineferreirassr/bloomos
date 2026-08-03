import { mockInvoiceTemplatesRepository } from "@/lib/data/mock/invoiceTemplatesStore";
import { mockInvoiceBuilderRepository } from "@/lib/data/mock/invoiceBuilderStore";

export type { InvoiceTemplatesRepository } from "@/lib/data/mock/invoiceTemplatesStore";
export type { InvoiceBuilderRepository } from "@/lib/data/mock/invoiceBuilderStore";

/** v2.0 Checkpoint 35 — Mock-only accessors, same precedent as `core/contractPlatform/index.ts`. No Supabase table exists yet for either of the 2 persisted entities this checkpoint owns (the real `Invoice`/`Payment` tables are reused as-is, untouched). */
export function getCoreInvoiceTemplatesService() {
  return mockInvoiceTemplatesRepository;
}

export function getCoreInvoiceBuilderService() {
  return mockInvoiceBuilderRepository;
}
