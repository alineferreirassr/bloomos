import type { HTMLAttributes } from "react";

type LuxuryCardTone = "surface" | "tint" | "subtle";

interface LuxuryCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: LuxuryCardTone;
}

const TONE_BACKGROUND: Record<LuxuryCardTone, string> = {
  surface: "bg-luxury-surface",
  tint: "bg-luxury-surface-tint",
  /** Final Clock + Weather Visual Refinement — a near-white surface only
   * barely distinguishable from `surface`, for a card that sits *inside*
   * another `surface` card (World Clock's city cards, the Weather cards)
   * and needs definition to come from the border/shadow, not a value gap.
   * `tint` stays for everywhere else that already uses it. */
  subtle: "bg-luxury-surface-subtle",
};

/** Checkpoint 19 — the Luxury Dashboard's own card surface: large radius, soft shadow, a fine champagne/gold hairline border (Contrast & Visual Finish Pass — the reference's light palette still reads distinct cards, which shadow/whitespace alone weren't achieving). `tone="tint"` is the soft blush variant used by "Important Notes"/reminder-style cards. */
export function LuxuryCard({ tone = "surface", className = "", ...props }: LuxuryCardProps) {
  return (
    <div
      className={`rounded-luxury-lg border border-luxury-border p-5 shadow-luxury-sm ${TONE_BACKGROUND[tone]} ${className}`}
      {...props}
    />
  );
}
