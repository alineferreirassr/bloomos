import { ProgressBar } from "@/components/ui/ProgressBar";
import { calculatePercentage } from "@/lib/money";

interface FulfillmentSummaryStripProps {
  resolved: number;
  total: number;
  className?: string;
}

/**
 * Fulfillment ("how many of this booking's requirements are resolved") is a
 * distinct concept from Service Health ("is the catalog Service well set
 * up") — never share terminology or a component between the two, even
 * though both end up rendering a percentage bar. `calculatePercentage`
 * already floors a zero-total division at 0 rather than producing NaN, so
 * a freshly-assigned EventService with no requirements yet shows 0%, not a
 * crash or a blank bar.
 */
export function FulfillmentSummaryStrip({ resolved, total, className = "" }: FulfillmentSummaryStripProps) {
  const percent = calculatePercentage(resolved, total);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <ProgressBar value={percent} label="Fulfillment" className="flex-1" />
      <span className="shrink-0 text-xs text-text-muted">
        {resolved} of {total} resolved
      </span>
    </div>
  );
}
