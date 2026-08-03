import type { HTMLAttributes } from "react";

type LuxuryCardTone = "surface" | "tint";

interface LuxuryCardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: LuxuryCardTone;
}

/** Checkpoint 19 — the Luxury Dashboard's own card surface: large radius, near-invisible shadow, no border (the reference images' cards are separated by shadow/whitespace, not a hairline like the Classical system's `Card`). `tone="tint"` is the soft blush variant used by "Important Notes"/reminder-style cards. */
export function LuxuryCard({ tone = "surface", className = "", ...props }: LuxuryCardProps) {
  return (
    <div
      className={`rounded-luxury-lg p-5 shadow-luxury-sm ${tone === "tint" ? "bg-luxury-surface-tint" : "bg-luxury-surface"} ${className}`}
      {...props}
    />
  );
}
