import type { ReactNode } from "react";

interface BloomWelcomeBannerProps {
  /** A real name/greeting subject — never a placeholder. */
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

/**
 * Checkpoint 19.3, Step 2 — a warm, editorial welcome moment for a page
 * whose whole purpose IS a greeting (an account/profile landing spot),
 * distinct from `PageHeader` (a neutral module title) and from the three
 * approved Dashboards' own `PersonalizedWelcomeHeader` (untouched, Luxury-
 * token only). Classical-token, soft gradient surface — see
 * `.bloom-gradient-surface` in globals.css.
 */
export function BloomWelcomeBanner({ title, subtitle, actions }: BloomWelcomeBannerProps) {
  return (
    <div className="bloom-gradient-surface animate-fade-down flex flex-col gap-4 rounded-lg border border-border p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-serif text-xl font-semibold text-text text-balance">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
