import { formatMoney } from "@/lib/money";

interface MoneyCellProps {
  amountMinor: number;
  currency?: string;
  /** Renders "—" instead of "$0.00" for a genuinely absent value (e.g. a debit column on a credit-only line) — distinct from a real zero balance, which always shows as currency. */
  hideZero?: boolean;
}

/**
 * The one place a report renders a money amount — every report component
 * calls this instead of formatting inline, so the whole Reports UI stays
 * consistent. Never recalculates the value it's given. Negative amounts
 * render with Intl's own leading minus sign (never color alone) plus a
 * muted color as a secondary cue.
 */
export function MoneyCell({ amountMinor, currency = "USD", hideZero = false }: MoneyCellProps) {
  if (hideZero && amountMinor === 0) {
    return <span className="text-text-muted">—</span>;
  }
  return <span className={amountMinor < 0 ? "text-danger" : "text-text"}>{formatMoney(amountMinor, currency)}</span>;
}
