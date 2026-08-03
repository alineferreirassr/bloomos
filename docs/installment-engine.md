# Installment Engine

`core/invoicePlatform/installmentEngine.ts`, `types/invoicePlatform.ts` (`InvoiceInstallment`, `InvoicePaymentScheduleKind`).

## A plan only — never a charge (Step 6)

`buildPaymentSchedule(kind, grandTotal_minor, options)` produces an `InvoiceInstallment[]` — a proposal of what's expected and when, never itself marked "paid," and never wired to any charging mechanism. Nothing in this file or anything that calls it moves money.

## 6 named schedule kinds

`single_payment`, `two_payments`, `three_payments`, `custom_schedule`, `deposit_final`, `milestone_payments` — `INVOICE_PAYMENT_SCHEDULE_KINDS` in `types/invoicePlatform.ts`.

| Kind | Produces |
|---|---|
| `single_payment` | 1 `final_payment` installment for the full total |
| `two_payments` | 2 evenly-split installments (`installment`, `final_payment`) |
| `three_payments` | 3 evenly-split installments (`installment`, `installment`, `final_payment`) |
| `deposit_final` | A `deposit` installment (`depositPercent`, defaulting to 30%) plus a `final_payment` for the remainder |
| `milestone_payments` | One `milestone` installment per caller-supplied `customInstallments` row (the last becomes `final_payment`) |
| `custom_schedule` | Same shape as `milestone_payments` but each row is a plain `installment` |

## 4 named installment kinds

`deposit`, `installment`, `final_payment`, `milestone` — `INVOICE_INSTALLMENT_KINDS`.

## Even-split rounding

`splitEvenly(total_minor, count)` puts any remainder into the **last** installment so the sum always exactly equals the input total — critical for `scheduleMatchesTotal` (the Health Engine's own "Schedule Health" check, [`invoice-health.md`](invoice-health.md)) to ever pass on totals that don't divide evenly.

## Helpers

`sumInstallments(schedule)` — the schedule's own total. `scheduleMatchesTotal(schedule, grandTotal_minor)` — `sumInstallments(schedule) === grandTotal_minor`, reused directly by both the Billing Engine and the Health Engine so the two never drift apart on what "matches" means.
