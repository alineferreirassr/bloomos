# Billing Engine & Credit/Adjustment Engine

`core/invoicePlatform/billingEngine.ts`, `core/invoicePlatform/creditAdjustmentEngine.ts`.

## Deterministic, no I/O (Step 5)

`computeInvoicePricing(input: ComputeInvoicePricingInput): InvoicePricingBreakdown` — pure arithmetic, no store access, no `Date.now()`. Orchestrates the Line Item ([`invoice-builder.md`](invoice-builder.md)), Credit & Adjustment, and [Installment](installment-engine.md) engines into one `InvoicePricingBreakdown`:

| Field | How it's computed |
|---|---|
| `lineItemsSubtotal_minor` | Sum of every non-discount, non-tax-placeholder line item |
| `discountsTotal_minor` | Sum of `discount`-kind line items (positive magnitude) |
| `taxPlaceholderTotal_minor` | Sum of `tax_placeholder`-kind line items |
| `subtotal_minor` | `lineItemsSubtotal_minor - discountsTotal_minor` |
| `adjustmentsTotal_minor` | `abs(netAdjustment_minor)` from the Credit & Adjustment Engine |
| `grandTotal_minor` | `max(0, subtotal_minor + taxPlaceholderTotal_minor + netAdjustment_minor)` |
| `depositDue_minor` | The schedule's own `deposit`-kind installment amount, or 0 |
| `remainingBalance_minor` | `max(0, grandTotal_minor - depositDue_minor)` |
| `installmentsTotal_minor` | Sum of every installment in the payment schedule |
| `paidToDate_minor` | The real `Invoice.paid_minor`, reused as-is |
| `outstandingBalance_minor` | `max(0, grandTotal_minor - paidToDate_minor)` |

Both `grandTotal_minor` and `outstandingBalance_minor` are clamped to never go negative.

## Credit & Adjustment Engine (Step 7)

`computeCreditsAndAdjustments(adjustments: InvoiceAdjustment[]): CreditAdjustmentBreakdown` groups the snapshot's own `InvoiceAdjustment[]` by its 6 named kinds — `credit`, `service_credit`, `invoice_credit`, `manual_adjustment`, `refund_placeholder`, `balance_carry_forward` — and returns:

- `totalReductions_minor` — the positive-magnitude sum of every kind except `balance_carry_forward` (all of which reduce what's owed)
- `totalCarryForward_minor` — the positive-magnitude sum of `balance_carry_forward` entries only (which *add* a prior invoice's unpaid balance onto this one)
- `netAdjustment_minor` — `totalCarryForward_minor - totalReductions_minor`, the one signed figure the Billing Engine consumes directly

By author convention, every kind's `amount_minor` is negative except `balance_carry_forward`, which is positive — the engine never flips a sign itself.

`refund_placeholder` never triggers a real refund — this checkpoint prepares the figure only; a real refund still requires the Payments module's own refund flow.

## Never a real payment

Nothing in either engine reads or writes the real `Payment` table. `paidToDate_minor` always arrives caller-supplied from the real `Invoice.paid_minor` — recomputing it from this checkpoint's own data would risk drifting from the one ledger that's actually authoritative.
