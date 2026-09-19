import type { ComponentType, SVGProps } from "react";

export type MetricStatSize = "primary" | "secondary";

interface MetricStatProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tint: string;
  value: string;
  label: string;
  /** "primary" is the single compositionally-dominant figure on a page (its own hero treatment); "secondary" (default) supports it. Tertiary figures are plain inline text, not this component — see e.g. RelationshipsLandingView's "Contracts In Progress" row. */
  size?: MetricStatSize;
}

/**
 * GLOBAL-VISUAL-03B — the shared metric primitive the foundation's
 * "primary / secondary / inline-tertiary" hierarchy is built from, factored
 * out of what GLOBAL-VISUAL-03A hand-rolled inline for Relationships' hero
 * Pipeline Value figure and its own local `SnapshotStat`. One component, one
 * size prop, instead of every page re-implementing the same icon-medallion +
 * serif-value composition at a slightly different scale.
 */
export function MetricStat({ icon: Icon, tint, value, label, size = "secondary" }: MetricStatProps) {
  const isPrimary = size === "primary";
  return (
    <div
      className={
        isPrimary
          ? "flex h-full items-center gap-4"
          : "flex items-center gap-3 py-4 first:pt-0 last:pb-0 sm:px-5 sm:py-1 sm:first:pl-0 sm:last:pr-0"
      }
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${isPrimary ? "h-14 w-14" : "h-10 w-10"}`}
        style={{ backgroundColor: `color-mix(in srgb, ${tint} 16%, var(--color-surface))` }}
      >
        <Icon className={isPrimary ? "h-6 w-6" : "h-[18px] w-[18px]"} style={{ color: tint }} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p
          className={`font-serif leading-none font-semibold text-text tabular-nums ${
            isPrimary ? "text-[2.125rem]" : "text-[1.375rem]"
          }`}
        >
          {value}
        </p>
        <p className={`text-text-muted ${isPrimary ? "mt-2 text-sm" : "mt-1 text-xs"}`}>{label}</p>
      </div>
    </div>
  );
}
