import { getInvoices } from "@/lib/data";
import { formatMoney } from "@/lib/money";

export interface PaymentForecastWeek {
  label: string;
  totalMinor: number;
}

export interface PaymentForecast {
  weeks: PaymentForecastWeek[];
  currency: string;
  totalMinor: number;
  summary: string;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Checkpoint 20, Step 12 — the Finance Assistant's Payment Forecast. A real,
 * deterministic bucketing of outstanding invoice balances by due date over
 * the next 4 weeks — never a projection or trend model, since this
 * checkpoint's own stop condition rules out anything that would need a
 * real forecasting/LLM provider to do honestly.
 */
export async function generatePaymentForecast(): Promise<PaymentForecast> {
  const invoices = await getInvoices({ includeArchived: false });
  const outstanding = invoices.filter((invoice) => ["issued", "sent", "viewed", "partially_paid", "overdue"].includes(invoice.status) && invoice.due_date);

  const now = Date.now();
  const weeks: PaymentForecastWeek[] = Array.from({ length: 4 }, (_, index) => ({ label: `Week ${index + 1}`, totalMinor: 0 }));

  for (const invoice of outstanding) {
    const dueTime = new Date(invoice.due_date as string).getTime();
    const weekIndex = Math.floor((dueTime - now) / ONE_WEEK_MS);
    if (weekIndex >= 0 && weekIndex < 4) {
      weeks[weekIndex].totalMinor += invoice.balance_minor;
    }
  }

  const currency = outstanding[0]?.currency ?? "USD";
  const totalMinor = weeks.reduce((sum, week) => sum + week.totalMinor, 0);
  const summary =
    totalMinor > 0
      ? `${formatMoney(totalMinor, currency)} expected across the next 4 weeks from already-outstanding invoices.`
      : "No outstanding invoices due in the next 4 weeks.";

  return { weeks, currency, totalMinor, summary };
}
