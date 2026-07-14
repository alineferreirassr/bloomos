import type { HTMLAttributes } from "react";

/* Matches the approved .tag system: tag-accent (won/converted, filled tint),
   tag-outline (in-progress stages, border only), tag-neutral (lost/archived).
   No separate success/warning/danger palette exists in the approved system —
   those three stay within the same warm accent family, differentiated only
   by weight, rather than introducing new colors. */
export type BadgeTone = "neutral" | "accent" | "outline" | "success" | "warning" | "danger";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "border-transparent bg-neutral-100 text-neutral-800",
  accent: "border-transparent bg-accent-100 text-accent-800",
  outline: "border-accent bg-transparent text-accent",
  success: "border-transparent bg-accent-100 text-accent-800",
  warning: "border-transparent bg-accent-100 text-accent-2",
  danger: "border-transparent bg-accent-100 text-danger",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-[3px] border px-2.5 py-0.5 text-[11px] tracking-wide ${toneClasses[tone]} ${className}`}
      {...props}
    />
  );
}
