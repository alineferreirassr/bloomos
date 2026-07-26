import { formatMoney, minorToMajor } from "@/lib/money";

interface ServicePriceProps {
  /** `null` means genuinely unavailable (e.g. no published version yet) — distinct from a real $0.00 price, which still renders normally. */
  amountMinor: number | null;
  currency: string;
  variant?: "regular" | "compact";
  className?: string;
}

const UNAVAILABLE_LABEL = "—";

/**
 * Always goes through money.ts's own integer-minor-unit helpers
 * (`formatMoney`/`minorToMajor`) rather than dividing by 100 itself — the
 * one place that division happens, and the one place a non-integer
 * minor-unit value gets caught (both helpers assert integers) instead of a
 * silent floating-point display bug.
 */
export function ServicePrice({ amountMinor, currency, variant = "regular", className = "" }: ServicePriceProps) {
  if (amountMinor === null) {
    return (
      <span className={`text-text-muted ${className}`} aria-label="Price unavailable">
        {UNAVAILABLE_LABEL}
      </span>
    );
  }

  if (variant === "compact") {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(minorToMajor(amountMinor));
    return <span className={className}>{formatted}</span>;
  }

  return <span className={className}>{formatMoney(amountMinor, currency)}</span>;
}
