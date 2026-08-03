"use client";

import { Tooltip } from "@/components/ui/Tooltip";
import { HEALTH_ATTENTION_THRESHOLD } from "@/lib/queries/services/health";

interface HealthDotProps {
  percent: number;
  /** The first (most important) entry of `ServiceHealthSummary.missing`, if the caller has it — surfaced in the tooltip/label so the dot never requires a second lookup to explain itself. */
  topMissingLabel?: string;
  /** Off in contexts that already show a tooltip-equivalent elsewhere (e.g. a dense table with its own hover row detail). On by default. */
  showTooltip?: boolean;
  className?: string;
}

/**
 * A compact catalog/table health signal — just a small filled dot, for
 * contexts where a full HealthGauge would be too wide (a list row, a table
 * cell). Only two tones exist (accent = healthy, danger = below the
 * attention threshold) — never a three-tier red/yellow/green scale. The
 * exact percentage (and the top missing item, if supplied) is always in the
 * accessible name, regardless of whether the tooltip is shown.
 */
export function HealthDot({ percent, topMissingLabel, showTooltip = true, className = "" }: HealthDotProps) {
  const needsAttention = percent < HEALTH_ATTENTION_THRESHOLD;
  const description = topMissingLabel ? `${percent}% complete — missing ${topMissingLabel}` : `${percent}% complete`;

  const dot = (
    <span
      tabIndex={0}
      role="img"
      aria-label={description}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${needsAttention ? "bg-danger" : "bg-accent"} ${className}`}
    />
  );

  if (!showTooltip) return dot;
  return <Tooltip content={description}>{dot}</Tooltip>;
}
