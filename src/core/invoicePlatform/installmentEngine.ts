import type { InvoiceInstallment, InvoicePaymentScheduleKind } from "@/types/invoicePlatform";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 35 — Installment Engine (Step 6). Pure schedule
 * generation — every amount is deterministic arithmetic over the already-
 * computed grand total, never a real charge. No automatic charging exists
 * anywhere in this file or anything that calls it; an `InvoiceInstallment`
 * is a plan only (see `types/invoicePlatform.ts`'s own doc comment).
 */

function installment(kind: InvoiceInstallment["kind"], label: string, dueDate: string | null, amount_minor: number): InvoiceInstallment {
  return { id: generateId("invoice_installment"), kind, label, dueDate, amount_minor };
}

/** Splits `total_minor` into `count` installments, the last one absorbing any rounding remainder so the sum always equals the input exactly. */
function splitEvenly(total_minor: number, count: number): number[] {
  const base = Math.floor(total_minor / count);
  const amounts = new Array(count).fill(base);
  amounts[count - 1] += total_minor - base * count;
  return amounts;
}

export interface BuildPaymentScheduleOptions {
  /** For `"deposit_final"` — defaults to 30. */
  depositPercent?: number;
  /** Due dates (ISO), applied in order to whichever installments this kind produces. */
  dueDates?: (string | null)[];
  /** Required for `"milestone_payments"` and `"custom_schedule"` — each entry's own label/amount. */
  customInstallments?: Array<{ label: string; amount_minor: number; dueDate: string | null }>;
}

export function buildPaymentSchedule(kind: InvoicePaymentScheduleKind, grandTotal_minor: number, options: BuildPaymentScheduleOptions = {}): InvoiceInstallment[] {
  const dueDates = options.dueDates ?? [];

  switch (kind) {
    case "single_payment":
      return [installment("final_payment", "Payment in Full", dueDates[0] ?? null, grandTotal_minor)];

    case "two_payments": {
      const [a, b] = splitEvenly(grandTotal_minor, 2);
      return [installment("installment", "Payment 1 of 2", dueDates[0] ?? null, a), installment("final_payment", "Payment 2 of 2", dueDates[1] ?? null, b)];
    }

    case "three_payments": {
      const [a, b, c] = splitEvenly(grandTotal_minor, 3);
      return [installment("installment", "Payment 1 of 3", dueDates[0] ?? null, a), installment("installment", "Payment 2 of 3", dueDates[1] ?? null, b), installment("final_payment", "Payment 3 of 3", dueDates[2] ?? null, c)];
    }

    case "deposit_final": {
      const depositPercent = options.depositPercent ?? 30;
      const deposit_minor = Math.round((grandTotal_minor * depositPercent) / 100);
      return [installment("deposit", "Deposit", dueDates[0] ?? null, deposit_minor), installment("final_payment", "Final Payment", dueDates[1] ?? null, grandTotal_minor - deposit_minor)];
    }

    case "milestone_payments":
    case "custom_schedule": {
      const custom = options.customInstallments ?? [];
      const kindForRow: InvoiceInstallment["kind"] = kind === "milestone_payments" ? "milestone" : "installment";
      return custom.map((row, i) => installment(i === custom.length - 1 ? "final_payment" : kindForRow, row.label, row.dueDate, row.amount_minor));
    }

    default:
      return [];
  }
}

export function sumInstallments(schedule: InvoiceInstallment[]): number {
  return schedule.reduce((sum, i) => sum + i.amount_minor, 0);
}

/** True when the schedule's own total exactly matches the grand total it's meant to cover — the Health Engine's own "Schedule Health" check reuses this. */
export function scheduleMatchesTotal(schedule: InvoiceInstallment[], grandTotal_minor: number): boolean {
  return sumInstallments(schedule) === grandTotal_minor;
}
