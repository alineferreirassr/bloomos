import type { ReactNode } from "react";

interface EditorialSectionHeaderProps {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}

/**
 * GLOBAL-VISUAL-03B.1 — the page-level editorial section opener, measured
 * directly from Dashboard's own "Your Day / A little look at today ♡" and
 * "Around Your Day" sections in OwnerDashboardView.tsx: a 12px semibold
 * tracked-wide wine eyebrow (`text-luxury-metadata`/`--color-accent`), a 4px
 * gap (`mt-1`), then a 28px serif title (`--luxury-text-page-size`, the same
 * scale `PageHeader`'s own title already uses). Distinct from the smaller,
 * card-scoped `SectionHeader` (18px, lives inside a `LuxuryCard` with a
 * "View all" action) — this is the larger, page-canvas-level section
 * opener, used directly on the page background, never inside a card.
 */
export function EditorialSectionHeader({ eyebrow, title, action }: EditorialSectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-accent uppercase">{eyebrow}</p>
        <h2 className="mt-1 font-serif text-[1.75rem] leading-tight font-semibold text-text">{title}</h2>
      </div>
      {action}
    </div>
  );
}
