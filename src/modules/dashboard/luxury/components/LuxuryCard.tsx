import type { HTMLAttributes } from "react";

type LuxuryCardTone = "surface" | "tint" | "page";

interface LuxuryCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: LuxuryCardTone;
}

const TONE_BACKGROUND: Record<LuxuryCardTone, string> = {
  surface: "bg-luxury-surface",
  tint: "bg-luxury-surface-tint",
  /** AF → BloomOS Clock + Weather Visual Parity Checkpoint — mechanically
   * confirmed from AF Digital Studio OS's own single-location clock card
   * (`WorldClockCard` "full" layout, `bg-ivory`): a standalone card that
   * doesn't nest inside another `surface`/`tint` wrapper uses the exact
   * same background as the page canvas, relying on the border + soft
   * shadow alone for separation — never a distinct "card" fill. Used by
   * Team/Client's single Clock card. */
  page: "bg-luxury-background",
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
