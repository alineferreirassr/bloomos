import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getInvoiceById, getContract } from "@/lib/data";
import { formatMoney, majorToMinor } from "@/lib/money";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

function daysBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

/**
 * The `"finance"` Merge Field domain (Step 4/12) — Invoice figures from
 * `context.invoiceId`, Contract figures from `context.contractId`. Every
 * currency value renders through `formatMoney()`, the same minor-unit
 * formatter Finance's own UI uses — never a hand-rolled `$` + division.
 * `invoice_payment_terms` is a derived value (days between `issue_date`
 * and `due_date`), not a stored field — Invoice itself has no
 * `payment_terms` column.
 */
export const financeMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "invoice_number", label: "Invoice Number", description: "The linked Invoice's own number.", domain: "finance", valueType: "string", required: false },
  { key: "invoice_subtotal", label: "Invoice Subtotal", description: "The linked Invoice's own subtotal, formatted as currency.", domain: "finance", valueType: "currency", required: false },
  { key: "invoice_tax", label: "Invoice Tax", description: "The linked Invoice's own tax amount, formatted as currency.", domain: "finance", valueType: "currency", required: false },
  { key: "invoice_discount", label: "Invoice Discount", description: "The linked Invoice's own discount amount, formatted as currency.", domain: "finance", valueType: "currency", required: false },
  { key: "invoice_total", label: "Invoice Total", description: "The linked Invoice's own total, formatted as currency.", domain: "finance", valueType: "currency", required: false },
  { key: "invoice_balance", label: "Invoice Outstanding Balance", description: "The linked Invoice's own remaining balance, formatted as currency.", domain: "finance", valueType: "currency", required: false },
  { key: "invoice_due_date", label: "Invoice Due Date", description: "The linked Invoice's own due date.", domain: "finance", valueType: "date", required: false },
  { key: "invoice_payment_terms", label: "Invoice Payment Terms", description: "Days between the linked Invoice's own issue and due dates.", domain: "finance", valueType: "string", required: false },
  { key: "contract_total", label: "Contract Total", description: "The linked Contract's own total value, formatted as currency.", domain: "finance", valueType: "currency", required: false },
  { key: "contract_deposit_amount", label: "Contract Deposit", description: "The linked Contract's own deposit amount, formatted as currency.", domain: "finance", valueType: "currency", required: false },
  { key: "contract_remaining_balance", label: "Contract Remaining Balance", description: "The linked Contract's own remaining balance, formatted as currency.", domain: "finance", valueType: "currency", required: false },
];

export function registerFinanceMergeFields(): void {
  for (const definition of financeMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("invoice_number", async (context) => {
    if (!context.invoiceId) return null;
    const invoice = await getInvoiceById(context.invoiceId).catch(() => null);
    return invoice?.invoice_number ?? null;
  });

  registerMergeResolver("invoice_subtotal", async (context) => {
    if (!context.invoiceId) return null;
    const invoice = await getInvoiceById(context.invoiceId).catch(() => null);
    return invoice ? formatMoney(invoice.subtotal_minor, invoice.currency) : null;
  });

  registerMergeResolver("invoice_tax", async (context) => {
    if (!context.invoiceId) return null;
    const invoice = await getInvoiceById(context.invoiceId).catch(() => null);
    return invoice ? formatMoney(invoice.tax_minor, invoice.currency) : null;
  });

  registerMergeResolver("invoice_discount", async (context) => {
    if (!context.invoiceId) return null;
    const invoice = await getInvoiceById(context.invoiceId).catch(() => null);
    return invoice ? formatMoney(invoice.discount_minor, invoice.currency) : null;
  });

  registerMergeResolver("invoice_total", async (context) => {
    if (!context.invoiceId) return null;
    const invoice = await getInvoiceById(context.invoiceId).catch(() => null);
    return invoice ? formatMoney(invoice.total_minor, invoice.currency) : null;
  });

  registerMergeResolver("invoice_balance", async (context) => {
    if (!context.invoiceId) return null;
    const invoice = await getInvoiceById(context.invoiceId).catch(() => null);
    return invoice ? formatMoney(invoice.balance_minor, invoice.currency) : null;
  });

  registerMergeResolver("invoice_due_date", async (context) => {
    if (!context.invoiceId) return null;
    const invoice = await getInvoiceById(context.invoiceId).catch(() => null);
    return invoice?.due_date ?? null;
  });

  registerMergeResolver("invoice_payment_terms", async (context) => {
    if (!context.invoiceId) return null;
    const invoice = await getInvoiceById(context.invoiceId).catch(() => null);
    if (!invoice?.issue_date || !invoice.due_date) return null;
    return `Net ${daysBetween(invoice.issue_date, invoice.due_date)}`;
  });

  registerMergeResolver("contract_total", async (context) => {
    if (!context.contractId) return null;
    const contract = await getContract(context.contractId).catch(() => null);
    return contract?.total_value !== null && contract?.total_value !== undefined ? formatMoney(majorToMinor(contract.total_value), contract.currency) : null;
  });

  registerMergeResolver("contract_deposit_amount", async (context) => {
    if (!context.contractId) return null;
    const contract = await getContract(context.contractId).catch(() => null);
    return contract?.deposit_amount !== null && contract?.deposit_amount !== undefined ? formatMoney(majorToMinor(contract.deposit_amount), contract.currency) : null;
  });

  registerMergeResolver("contract_remaining_balance", async (context) => {
    if (!context.contractId) return null;
    const contract = await getContract(context.contractId).catch(() => null);
    return contract?.remaining_balance !== null && contract?.remaining_balance !== undefined
      ? formatMoney(majorToMinor(contract.remaining_balance), contract.currency)
      : null;
  });
}
