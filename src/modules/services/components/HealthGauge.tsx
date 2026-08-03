import { ProgressBar } from "@/components/ui/ProgressBar";

interface HealthGaugeProps {
  percent: number;
  variant?: "compact" | "full";
  label?: string;
  className?: string;
}

/**
 * Composes the generic ProgressBar rather than reimplementing progress
 * semantics (role/aria-valuenow/visible percentage) a second time — the only
 * thing this component adds is the "Service health" framing. Deliberately
 * has no percent-tier color logic at all (never red/yellow/green): the bar
 * is always the one accent fill, at every percentage.
 */
export function HealthGauge({ percent, variant = "full", label = "Service health", className = "" }: HealthGaugeProps) {
  if (variant === "compact") {
    return <ProgressBar value={percent} label={label} className={className} />;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-xs text-text-muted">{label}</p>
      <ProgressBar value={percent} label={label} />
    </div>
  );
}
