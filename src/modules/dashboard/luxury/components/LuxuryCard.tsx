import type { HTMLAttributes } from "react";

type LuxuryCardTone = "surface" | "tint";

interface LuxuryCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: LuxuryCardTone;
}

/** Checkpoint 19 — the Luxury Dashboard's own card surface: large radius, soft shadow, a fine champagne/gold hairline border (Contrast & Visual Finish Pass — the reference's light palette still reads distinct cards, which shadow/whitespace alone weren't achieving). `tone="tint"` is the soft blush variant used by "Important Notes"/reminder-style cards. */
export function LuxuryCard({ tone = "surface", className = "", ...props }: LuxuryCardProps) {
  return (
    <div
      className={`rounded-luxury-lg border border-luxury-border p-5 shadow-luxury-sm ${tone === "tint" ? "bg-luxury-surface-tint" : "bg-luxury-surface"} ${className}`}
      {...props}
    />
  );
}
