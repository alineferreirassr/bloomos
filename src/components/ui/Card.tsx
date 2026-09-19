import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement>;

/* Checkpoint 19.1 — Global Luxury Rollout. Matches the Owner Dashboard's own
   LuxuryCard recipe exactly (rounded-lg + shadow-sm + a real surface fill),
   since every card in the app now shares one design system rather than the
   Dashboard alone. GLOBAL-VISUAL-04R — this primitive has 160+ consumers
   across every module (Analytics, Finance-adjacent Services, Client Portal,
   Settings, etc.), far beyond the authorized CRM scope, so it is
   deliberately left untouched here — see GLOBAL-VISUAL-04R final report,
   Card.tsx entry, for why. */
export function Card({ className = "", ...props }: CardProps) {
  return (
    <div
      className={`bloom-elevation-card rounded-lg border border-border bg-surface p-4 transition-shadow duration-200 hover:shadow-md ${className}`}
      {...props}
    />
  );
}
