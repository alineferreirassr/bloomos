import type { HTMLAttributes } from "react";

/* Matches the approved .tag system: tag-accent (won/converted/primary,
   filled tint), tag-outline (in-progress stages, border only), tag-neutral
   (lost/archived/inactive). Checkpoint 19.3 — Bloom Status Badge system:
   success/warning/danger now render with the real distinct hues Checkpoint
   19.1 introduced (--color-success/-warning/-danger), matching the Luxury
   Dashboard's own StatusBadge exactly, instead of all three previously
   rendering as the same rose/accent tint. See docs/bloom-design-language.md
   for the full status→tone convention every *StatusBadge component follows. */
export type BadgeTone = "neutral" | "accent" | "outline" | "success" | "warning" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-transparent bg-neutral-100 text-neutral-800",
  accent: "border-transparent bg-accent-100 text-accent-800",
  outline: "border-accent bg-transparent text-accent",
  success: "border-transparent bg-success/10 text-success",
  warning: "border-transparent bg-warning/10 text-warning",
  danger: "border-transparent bg-danger/10 text-danger",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
