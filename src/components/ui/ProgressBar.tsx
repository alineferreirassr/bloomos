interface ProgressBarProps {
  /** 0-100. Values outside that range are clamped rather than rejected — a caller computing a percentage from live data shouldn't need to clamp it itself first. */
  value: number;
  label?: string;
  className?: string;
}

/**
 * The one generic progress/health indicator every future percentage-based
 * surface (Service completeness, a health score, an upload's progress)
 * reaches for — `role="progressbar"` plus `aria-valuenow`/`min`/`max` so
 * assistive tech announces the real number, and the percentage is always
 * rendered as visible text alongside the bar, never color alone, so the
 * value reads the same for a color-blind user or in a screenshot with no
 * color at all.
 */
export function ProgressBar({ value, label, className = "" }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const rounded = Math.round(clamped);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-valuenow={rounded}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-text/10"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-[var(--duration-base-ms)] ease-[var(--easing-standard)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-text-muted">{rounded}%</span>
    </div>
  );
}
