import { formatMoney } from "@/lib/money";

interface VarianceCellProps {
  varianceMinor: number | null;
  currency?: string;
}

/**
 * Renders a comparison-period variance exactly as the Repository returned
 * it (current minus comparison — see calculateVariance in
 * reportCalculations.ts) — never recomputed here. `null` means no
 * comparison was requested, shown distinctly from a real zero variance. The
 * sign is always a textual "+"/"−" prefix, never color alone.
 */
export function VarianceCell({ varianceMinor, currency = "USD" }: VarianceCellProps) {
  if (varianceMinor === null) {
    return <span className="text-text-muted">—</span>;
  }
  const isPositive = varianceMinor > 0;
  const isNegative = varianceMinor < 0;
  return (
    <span className={isNegative ? "text-danger" : isPositive ? "text-accent" : "text-text-muted"}>
      {isPositive ? "+" : ""}
      {formatMoney(varianceMinor, currency)}
    </span>
  );
}
