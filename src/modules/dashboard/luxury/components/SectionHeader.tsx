import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
}

/** Checkpoint 19 — the "{Section title} ... View all" row atop every Luxury dashboard card group, reused by every section rather than each card re-implementing its own header row. */
export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-luxury-display text-luxury-section font-semibold text-luxury-text">{title}</h2>
      {action}
    </div>
  );
}
