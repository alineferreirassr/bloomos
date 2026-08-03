# Invoice Builder

`core/invoicePlatform/invoiceBuilderEngine.ts`, `core/invoicePlatform/lineItemEngine.ts`, `types/invoicePlatform.ts` (`InvoiceLineItem`, `InvoiceSection`, `CreateInvoiceVersionInput`).

## 9 named line item kinds (Step 4)

`service`, `package`, `product`, `fee`, `travel`, `rental`, `labor`, `discount`, `tax_placeholder` — `INVOICE_LINE_ITEM_KINDS` in `types/invoicePlatform.ts`. By author convention, `discount`/`tax_placeholder` line items carry a negative `amount_minor` — the engine never flips a sign itself; the caller (the module layer, from the Builder form) decides the sign when constructing the item. `sumRevenueLineItems`/`sumDiscountLineItems`/`sumTaxPlaceholderLineItems` (`lineItemEngine.ts`) split a `InvoiceLineItem[]` by that convention for the [Billing Engine](billing-engine.md) to consume.

`tax_placeholder` is deliberately named — this checkpoint prepares a placeholder line for tax, never a real tax-calculation integration.

## Sections

`InvoiceSection` is a plain `{ id, title, isCustom }` container a template's `defaultSectionTitles` populates by default; line items reference a section via `sectionId`. `groupLineItemsBySection` (`lineItemEngine.ts`) is a pure grouping helper the Detail view uses to render items under their own section headings.

## Assembling a snapshot

`assembleSnapshot(input: AssembleInvoiceSnapshotInput): InvoiceSnapshot` — pure, no I/O. Takes an already-resolved `CreateInvoiceVersionInput` (header, sections, line items, adjustments, payment schedule, terms, policies, footer, notes, reason) plus the real invoice's own `currency` and `paidToDate_minor` (the real `Invoice.paid_minor`, reused never recomputed), and calls `computeInvoicePricing` ([`billing-engine.md`](billing-engine.md)) internally before freezing everything into one `InvoiceSnapshot` by value. The module layer (`invoicePlatformActions.ts`) resolves the real-I/O inputs and passes them in already-known; this file only assembles and computes pricing.

## The in-app Builder UI

`InvoiceDetailView.tsx`'s own "New Version" panel ([`invoice-detail.md`](invoice-detail.md)) is a purposefully compact template-select + freeform line-item-rows form, not a full drag-and-drop block editor — the same scope discipline `ProposalDetailView`'s own Builder panel (Checkpoint 33) established. A user picks a template, adds one or more line items (kind/label/amount), and submits; the form defaults the payment schedule to a single `final_payment` installment equal to the computed total, editable through later versions. Every field the form submits flows through the same tested `CreateInvoiceVersionInput` the engines were built and tested against.
